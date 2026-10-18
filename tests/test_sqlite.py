import copy
import importlib.util
import json
from pathlib import Path
import unittest

BASE=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('archive_import',BASE/'archive_tools'/'archive_to_sqlite.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.db=mod.connect(':memory:')
        self.archive=json.loads((BASE/'tests'/'garmin-archive-fixture.json').read_text())
    def tearDown(self):
        self.db.close()
    def test_import_and_repeat_no_duplicate(self):
        mod.import_archive(self.db,self.archive)
        mod.import_archive(self.db,self.archive)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM activities').fetchone()[0],1)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM snapshots').fetchone()[0],1)
        self.assertEqual(self.db.execute('SELECT COUNT(*), SUM(reps) FROM lifting_sets').fetchone(),(7,20))
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM exercise_records').fetchone()[0],14)
    def test_revision_removes_deleted_set_and_preserves_snapshot(self):
        mod.import_archive(self.db,self.archive)
        newer=copy.deepcopy(self.archive);newer['archived_at']='2026-01-19T12:00:00.000Z';newer['records']=newer['records'][:-2]
        newer['totals']['active_sets']=6
        mod.import_archive(self.db,newer)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM exercise_records').fetchone()[0],12)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM snapshots').fetchone()[0],2)
        mod.import_archive(self.db,self.archive)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM exercise_records').fetchone()[0],12)
    def test_invalid_archive_and_duplicate_indices_rejected(self):
        bad=copy.deepcopy(self.archive);bad['finalized_by_user']=False
        with self.assertRaises(ValueError):mod.import_archive(self.db,bad)
        bad=copy.deepcopy(self.archive);bad['records'][1]['source_record_index']=0
        with self.assertRaises(ValueError):mod.import_archive(self.db,bad)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM activities').fetchone()[0],0)
    def test_conflicting_timestamp_rolls_back(self):
        mod.import_archive(self.db,self.archive)
        bad=copy.deepcopy(self.archive);bad['activity']['description']='conflicting notes'
        with self.assertRaises(ValueError):mod.import_archive(self.db,bad)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM snapshots').fetchone()[0],1)
        self.assertNotEqual(self.db.execute('SELECT description FROM activities').fetchone()[0],'conflicting notes')

if __name__=='__main__':unittest.main()
