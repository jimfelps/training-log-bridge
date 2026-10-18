#!/usr/bin/env python3
"""Import finalized browser archives into a portable SQLite training log. Python 3.10+."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sqlite3
from datetime import datetime

SCHEMA = '''
CREATE TABLE IF NOT EXISTS activities (
 activity_id TEXT PRIMARY KEY, archived_at TEXT NOT NULL, name TEXT, start_time_local TEXT,
 activity_type TEXT, associated_workout_id TEXT, description TEXT,
 provider TEXT, cycle TEXT, pushpress_workout_id TEXT, archive_note TEXT,
 active_sets INTEGER, reps INTEGER, loaded_volume_kg REAL, loaded_volume_lb REAL,
 activity_json TEXT NOT NULL, totals_json TEXT NOT NULL, warnings_json TEXT NOT NULL,
 archive_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS exercise_records (
 activity_id TEXT NOT NULL REFERENCES activities(activity_id) ON DELETE CASCADE,
 record_index INTEGER NOT NULL, set_type TEXT NOT NULL, active_set_number INTEGER,
 exercise_category TEXT, exercise_name TEXT, reps INTEGER, weight_kg REAL, weight_lb REAL,
 duration_seconds REAL, rest_after_seconds REAL, start_time_raw TEXT, record_json TEXT NOT NULL,
 PRIMARY KEY(activity_id,record_index)
);
CREATE TABLE IF NOT EXISTS snapshots (
 activity_id TEXT NOT NULL, archived_at TEXT NOT NULL, sha256 TEXT NOT NULL,
 imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, archive_json TEXT NOT NULL,
 PRIMARY KEY(activity_id,sha256)
);
CREATE INDEX IF NOT EXISTS exercise_name_idx ON exercise_records(exercise_name);
CREATE VIEW IF NOT EXISTS lifting_sets AS
 SELECT a.start_time_local,a.name AS activity_name,a.provider,a.cycle,
 r.activity_id,r.active_set_number,r.exercise_category,r.exercise_name,r.reps,
 r.weight_kg,r.weight_lb,r.duration_seconds,r.rest_after_seconds
 FROM exercise_records r JOIN activities a ON r.activity_id=a.activity_id
 WHERE r.set_type='ACTIVE';
'''

def validate(data):
    if not isinstance(data,dict) or data.get('schema_version') != 1 or data.get('source') != 'garmin_connect':
        raise ValueError('Use the JSON from Archive finalized activity, not a raw response or Garmin workout file.')
    if data.get('finalized_by_user') is not True:
        raise ValueError('Archive has not been confirmed as finalized.')
    aid=data.get('activity_id')
    if not isinstance(aid,str) or not aid.isdigit() or not 1 <= len(aid) <= 16:
        raise ValueError('Invalid activity_id.')
    try:
        timestamp=datetime.fromisoformat(data['archived_at'].replace('Z','+00:00'))
        if timestamp.utcoffset() is None:
            raise ValueError('Archive timestamp needs a timezone.')
    except (ValueError,KeyError,AttributeError,TypeError) as err:
        raise ValueError('Invalid archived_at timestamp.') from err
    for name in ['activity','context','totals','source_snapshots']:
        if not isinstance(data.get(name),dict):
            raise ValueError('Missing archive object: '+name)
    if not isinstance(data.get('warnings'),list):
        raise ValueError('Missing warnings array.')
    records=data.get('records')
    if not isinstance(records,list) or len(records)>10000:
        raise ValueError('Invalid records list.')
    seen=set()
    for r in records:
        if not isinstance(r,dict) or not isinstance(r.get('set_type'),str):
            raise ValueError('Invalid exercise record.')
        idx=r.get('source_record_index')
        if type(idx) is not int or idx<0 or idx in seen:
            raise ValueError('Invalid or duplicate record index.')
        seen.add(idx)
        for key in ['reps','weight_kg','weight_lb','duration_seconds','rest_after_seconds']:
            val=r.get(key)
            if val is not None and (isinstance(val,bool) or not isinstance(val,(int,float)) or not math.isfinite(val) or val<0):
                raise ValueError('Invalid non-negative numeric value: '+key)
    return timestamp

def import_archive(db, data):
    stamp=validate(data)
    aid=data['activity_id']
    serialized=json.dumps(data,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False)
    digest=hashlib.sha256(serialized.encode()).hexdigest()
    a,c,t=data['activity'],data['context'],data['totals']
    with db:
        db.execute('INSERT OR IGNORE INTO snapshots(activity_id,archived_at,sha256,archive_json) VALUES (?,?,?,?)',
                   (aid,data['archived_at'],digest,serialized))
        current=db.execute('SELECT archived_at,archive_json FROM activities WHERE activity_id=?',(aid,)).fetchone()
        if current:
            previous_stamp=datetime.fromisoformat(current[0].replace('Z','+00:00'))
            if previous_stamp>stamp:
                return 'older snapshot retained; current results unchanged'
            if previous_stamp==stamp and current[1]!=serialized:
                raise ValueError('Conflicting archives have the same timestamp; current activity was not changed.')
        vals=(aid,data['archived_at'],a.get('name'),a.get('start_time_local_raw'),a.get('type'),a.get('associated_workout_id'),
              a.get('description'),c.get('programming_provider'),c.get('cycle'),c.get('pushpress_workout_id'),c.get('archive_note'),
              t.get('active_sets'),t.get('reps'),t.get('loaded_volume_kg'),t.get('loaded_volume_lb'),
              json.dumps(a),json.dumps(t),json.dumps(data['warnings']),serialized)
        columns='activity_id,archived_at,name,start_time_local,activity_type,associated_workout_id,description,provider,cycle,pushpress_workout_id,archive_note,active_sets,reps,loaded_volume_kg,loaded_volume_lb,activity_json,totals_json,warnings_json,archive_json'
        # Replace set rows as one transaction: deleted or corrected sets cannot linger.
        db.execute('DELETE FROM exercise_records WHERE activity_id=?',(aid,))
        updates=','.join(f'{col}=excluded.{col}' for col in columns.split(',') if col!='activity_id')
        db.execute('INSERT INTO activities('+columns+') VALUES ('+','.join('?' for _ in vals)+') ON CONFLICT(activity_id) DO UPDATE SET '+updates,vals)
        for r in data['records']:
            db.execute('INSERT INTO exercise_records VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
                       (aid,r['source_record_index'],r['set_type'],r.get('active_set_number'),r.get('exercise_category'),r.get('exercise_name'),r.get('reps'),r.get('weight_kg'),r.get('weight_lb'),r.get('duration_seconds'),r.get('rest_after_seconds'),r.get('start_time_raw'),json.dumps(r)))
    return 'updated' if current else 'added'

def connect(path):
    db=sqlite3.connect(path)
    db.execute('PRAGMA foreign_keys=ON')
    db.executescript(SCHEMA)
    return db

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db',default='training_log.sqlite',help='Path for your SQLite database.')
    parser.add_argument('archives',nargs='+',help='One or more finalized Garmin JSON archive files.')
    args=parser.parse_args()
    db=connect(args.db)
    failed=False
    try:
        for filename in args.archives:
            try:
                with open(filename,encoding='utf-8-sig') as f:
                    data=json.load(f,parse_constant=lambda val: (_ for _ in ()).throw(ValueError('Invalid JSON number: '+val)))
                print(f'{Path(filename).name}: {import_archive(db,data)}')
            except (ValueError,OSError,sqlite3.Error) as err:
                failed=True
                print(f'{Path(filename).name}: FAILED — {err}')
        print('Database:',Path(args.db).resolve())
    finally:
        db.close()
    return 1 if failed else 0

if __name__=='__main__':
    raise SystemExit(main())
