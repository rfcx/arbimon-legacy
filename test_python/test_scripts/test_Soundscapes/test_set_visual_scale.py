import unittest
from mock import MagicMock
import mock
from mock import patch
from contextlib import contextmanager
from mock import Mock

class db_mock:
    calls = []
    def __init__(self,vv=None):
        self.calls = []
        self.vv = vv
        pass
    def execute(self,q,a=None):
        self.calls.append({'f':'execute','q':q,'a':a})
    def close(self):
        self.calls.append({'f':'close'})
    def cursor(self):
        self.calls.append({'f':'cursor'})
        co = close_obj(self.vv)
        return co
    def commit(self):
        pass
    
sCapeMock_calls = []
class sCapeMock(object):
    stats = {}
    def __init__(self):
        self.stats['max_count'] = 0
    def write_image(self,f,p ):
        global sCapeMock_calls
        sCapeMock_calls.append({'f':'write_image','file':f,'p':p})
        
close_obj_calls =[]
class close_obj:
    def __init__(self,vv):
        self.vv = vv
        pass
    def close(self):
        global close_obj_calls
        close_obj_calls.append({'f':'close'})
    def execute(self,q,a=None):
        global close_obj_calls
        close_obj_calls.append({'f':'execute','q':q,'a':a})
    def fetchone(self):
        global close_obj_calls
        close_obj_calls.append({'f':'fetch_one'})
        return self.vv
    def __iter__(self):
        close_obj_calls.append({'f':'__iter__'})
        return iter(self.vv)

mock_closing_calls = [] 
@contextmanager           
def mock_closing(filen):
    global mock_closing_calls
    mock_closing_calls.append(filen)
    mm = close_obj(filen)
    try:
        yield mm
    finally:
        mm.close()

keyMockCalls = []
class keyMock(object):
    def __init__(self):
        pass
    def get_contents_to_filename(self, a ):
        global keyMockCalls
        keyMockCalls.append({'f':'get_contents_to_filename','a':a})    
    def set_contents_from_filename(self,f ):
        global keyMockCalls
        keyMockCalls.append({'f':'set_contents_from_filename','u':f})
    def set_acl(self,a):
        global keyMockCalls
        keyMockCalls.append({'f':'set_acl','u':a})
    
bucket_mock_calls = []
class bucket_mock:
    def __init__(self,raisee=False):
        self.raisee = raisee
    def new_key(self,uri):
        global bucket_mock_calls
        bucket_mock_calls.append({'f':'new_key','u':uri})
        if self.raisee:
            raise IOError
        else:
            return keyMock()
    def get_key(self,scidx_uri, validate=False ):
        global bucket_mock_calls
        bucket_mock_calls.append({'f':'get_key','u':scidx_uri})
        return keyMock()
    
conn_mock_calls= []    
class conn_mock:
    def __init__(self,a,b):
        global conn_mock_calls
        conn_mock_calls.append({'f':'init','a':a,'b':b})
    def get_bucket(self,bn,validate=None):
        global conn_mock_calls
        conn_mock_calls.append({'f':'get_bucket','b':bn,'a':validate})
        return bucket_mock()

new_con_calls = []
def new_con(a,b):
    global new_con_calls
    new_con_calls.append({'a':a,'b':b})
    return conn_mock(a,b)

new_con_none_calls = []
def new_con_none(a,b):
    global new_con_none_calls
    new_con_none_calls.append({'a':a,'b':b})
    return None

isInstanceMockFalse_calls = []
def isInstanceMockFalse(a,b):
    global isInstanceMockFalse_calls
    isInstanceMockFalse_calls.append({'a':a,'b':str(b)})
    return False

isInstanceMockTrue_calls = []
def isInstanceMockTrue(a,b):
    global isInstanceMockTrue_calls
    isInstanceMockTrue_calls.append({'a':str(a),'b':str(b)})
    return True

file_cache_mock_calls = []
class file_cache_mock(object):
    def __init__(self,ret):
        self.ret = ret
    def fetch(self,uri):
        global file_cache_mock_calls
        file_cache_mock_calls.append({'f':'fetch','u':uri})
        return self.ret

scidxFile_Calls = []  
class scidxFile(object):
    def __init__(self, n):
        self.file = n
    def retry_get(self):
        global scidxFile_Calls
        scidxFile_Calls.append({'f':'retry_get'})
        return self.file

class file_cache_mock_retry(object):
    def __init__(self,ret):
        self.ret = ret
    def fetch(self,uri):
        global file_cache_mock_calls
        file_cache_mock_calls.append({'f':'fetch','u':uri})
        return scidxFile(self.ret ) 

class Test_set_visual_scale_lib(unittest.TestCase):

    def test_imports(self):
        """Test set_visual_scale"""
        try:
            from soundscape.set_visual_scale_lib import run
            from soundscape.set_visual_scale_lib import exit_error
            from soundscape.set_visual_scale_lib import get_db
            from soundscape.set_visual_scale_lib import get_sc_data
            from soundscape.set_visual_scale_lib import get_bucket
            from soundscape.set_visual_scale_lib import get_scidx_file
            from soundscape.set_visual_scale_lib import write_image
            from soundscape.set_visual_scale_lib import upload_image
            from soundscape.set_visual_scale_lib import update_db
        except:
            self.fail('set_visual_scale_lib: error importing some of the functions')
    
    def test_exit_error(self):
        """Test the exit_error procedure"""
        from soundscape.set_visual_scale_lib import exit_error
        sys_exit = MagicMock()
        with mock.patch('sys.exit', sys_exit, create=False):
            exit_error('THIS IS NOT AN ERROR\nTHIS IS A TESTING MESSAGE\nTESTING THE EXIT_ERROR FUNCTION\nTHIS IS NOT AN ERROR')
        sys_exit.assert_any_call(-1)
    
    @patch('MySQLdb.connect')
    @patch('MySQLdb.cursors.DictCursor')
    def test_get_db(self,cursorDictMock,mysql_connect):
        """Test the get_db procedure"""
        from soundscape.set_visual_scale_lib import get_db
        exitErr = MagicMock()
        with mock.patch('soundscape.set_visual_scale_lib.exit_error', exitErr, create=False):
            mysql_connect.return_value = None
            self.assertIsNone(get_db(['host','user','pass','dbname']))
            mysql_connect.return_value = 'NotNone'
            self.assertEqual('NotNone',get_db(['host','user','pass','dbname']))
        exitErr.assert_any_calls('cannot connect to database.')
        mysql_connect.assert_call(passwd='pass', host='host', db='dbname', cursorclass=cursorDictMock, user='user')
        mysql_connect.assert_call(passwd='pass', host='host', db='dbname', cursorclass=cursorDictMock, user='user')
    
    def test_get_sc_data(self):
        """Test the get_sc_data procedure"""
        global close_obj_calls
        global mock_closing_calls
        close_obj_calls=[]
        from soundscape.set_visual_scale_lib import get_sc_data
        exitErr = MagicMock()
        with mock.patch('soundscape.set_visual_scale_lib.exit_error', exitErr, create=False):
            with mock.patch('contextlib.closing', mock_closing , create=False):
                dbMock = db_mock()
                self.assertIsNone(get_sc_data(dbMock,1),msg="get_sc_data : should have returned None")
                del dbMock
                dbMock = db_mock(1)
                self.assertEqual(get_sc_data(dbMock,1),1,msg="get_sc_data : incorrect return value")
        self.assertEqual(dbMock.calls[0],{'f': 'cursor'},msg="get_sc_data: call not found")
        select_query = '\n                SELECT S.uri, S.playlist_id, SAT.identifier as aggregation\n                FROM soundscapes S\n                JOIN soundscape_aggregation_types SAT ON S.soundscape_aggregation_type_id = SAT.soundscape_aggregation_type_id\n                WHERE soundscape_id = %s\n            '
        closeObjCalls = [{'q': select_query, 'a': [1], 'f': 'execute'},
                         {'f': 'fetch_one'},
                         {'f': 'close'},
                         {'q': select_query, 'a': [1], 'f': 'execute'},
                         {'f': 'fetch_one'},
                         {'f': 'close'}]
        try:
            for i in range(len(closeObjCalls)):
                self.assertEqual(closeObjCalls[i],close_obj_calls[i],msg="get_sc_data: calls should be the same")
        except:
            self.fail('get_sc_data: Incorrect number of calls')
        exitErr.assert_any_calls('Soundscape #1 not found')

    def test_get_norm_vector(self):
        """Test the get_norm_vector procedure"""
        global close_obj_calls
        global mock_closing_calls
        close_obj_calls = []
        from soundscape.set_visual_scale_lib import get_norm_vector
        exitErr = MagicMock()
        with mock.patch('contextlib.closing', mock_closing, create=False):
            dbMock = db_mock([
                {'dp_0': '1', 'count': 1},
                {'dp_0': '2', 'count': 3}
            ])
            result = get_norm_vector(dbMock, {'aggregation': 'time_of_day', 'playlist_id': 1})
            expected_result = {1: 1, 2: 3}
            self.assertEqual(result, expected_result, msg="get_norm_vector : incorrect return value")
        self.assertEqual(dbMock.calls[0],{'f': 'cursor'},msg="get_norm_vector: call not found")
        select_query = (
            '\n' +
            '                SELECT DATE_FORMAT(R.datetime, "%H") as dp_0 , COUNT(*) as count\n' +
            '                FROM `playlist_recordings` PR\n' +
            '                JOIN `recordings` R ON R.recording_id = PR.recording_id\n' +
            '                WHERE PR.playlist_id = 1\n' +
            '                GROUP BY DATE_FORMAT(R.datetime, "%H")\n' +
            '            '
        )
        closeObjCalls = [
            {'q': select_query, 'a': None, 'f': 'execute'},
            {'f': '__iter__'},
            {'f': 'close'}
        ]
        try:
            for i in range(len(closeObjCalls)):
                self.assertEqual(closeObjCalls[i], close_obj_calls[i], msg="get_norm_vector: calls should be the same")
        except:
            self.fail('get_norm_vector: Incorrect number of calls')
    
    def test_get_bucket(self):
        """Test get_bucket procedure"""
        global bucket_mock_calls
        global conn_mock_calls
        global new_con_calls
        global new_con_none_calls
        new_con_calls = []
        bucket_mock_calls = []
        conn_mock_calls = []
        from soundscape.set_visual_scale_lib import get_bucket
        exitErr = MagicMock()
        with mock.patch('boto.s3.connection.S3Connection', new_con_none, create=False):
            with mock.patch('soundscape.set_visual_scale_lib.exit_error', exitErr, create=False):
                self.assertIsNone(get_bucket(['d','d','d','d','bucketName','awsKey','awsPass']))
        with mock.patch('boto.s3.connection.S3Connection', new_con, create=False):
            with mock.patch('soundscape.set_visual_scale_lib.exit_error', exitErr, create=False):
                self.assertIsInstance( get_bucket(['d','d','d','d','bucketName','awsKey','awsPass']),bucket_mock)

        exitErr.assert_any_calls('cannot not connect to aws.')
        self.assertEqual(conn_mock_calls[0],{'a': 'awsKey', 'b': 'awsPass', 'f': 'init'},msg="get_bucket: AWS Connection call incorrect")
        self.assertEqual(new_con_calls[0],{'a': 'awsKey', 'b': 'awsPass'},msg="get_bucket: S3Connection call incorrect")
        self.assertEqual(new_con_none_calls[0],{'a': 'awsKey', 'b': 'awsPass'},msg="get_bucket: S3Connection call incorrect")
    
    def test_get_scidx_file_notinstance(self):
        """Test get_scidx_file procedure"""
        global file_cache_mock_calls
        global isInstanceMockFalse_calls
        global bucket_mock_calls
        bucket_mock_calls = []
        isInstanceMockFalse_calls= []
        file_cache_mock_calls = []
        from soundscape.set_visual_scale_lib import get_scidx_file
        exitErr = MagicMock()
        bucketMock = bucket_mock()
        with mock.patch('soundscape.set_visual_scale_lib.exit_error', exitErr, create=False):
            with mock.patch('__builtin__.isinstance',isInstanceMockFalse, create=False):
                fcm = file_cache_mock(None)
                get_scidx_file('randomUri',fcm,bucketMock)
            
        self.assertEqual(file_cache_mock_calls[0],{'u': 'randomUri', 'f': 'fetch'},msg="get_scidx_file: file cache wrong call")
        self.assertEqual(isInstanceMockFalse_calls[0],{'a': None, 'b': "<class 'a2pyutils.tempfilecache.CacheMiss'>"})
        self.assertEqual(len(bucket_mock_calls),0,msg="get_scidx_file: bucket new_key should have not been call")
        exitErr.assert_ant_calls('cannot not retrieve scidx_file.')
        exitErr.reset_mock()
        
    def test_get_scidx_file(self):
        """Test get_scidx_file procedure"""
        global file_cache_mock_calls
        global isInstanceMockTrue_calls
        global bucket_mock_calls
        global scidxFile_Calls
        global keyMockCalls
        keyMockCalls = []
        scidxFile_Calls = []
        bucket_mock_calls = []
        isInstanceMockTrue_calls= []
        file_cache_mock_calls = []
        from soundscape.set_visual_scale_lib import get_scidx_file
        exitErr = MagicMock()
        bucketMock = bucket_mock()
        with mock.patch('soundscape.set_visual_scale_lib.exit_error', exitErr, create=False):
            with mock.patch('__builtin__.isinstance',isInstanceMockTrue, create=False):
                fcm = file_cache_mock_retry('a file')
                get_scidx_file('randomUri',fcm,bucketMock)
            
        self.assertEqual(keyMockCalls[0] ,{'a': 'a file', 'f': 'get_contents_to_filename'},msg="get_scidx_file: get_contents_to_filename call wrong")
        self.assertEqual(scidxFile_Calls[0],{'f': 'retry_get'},msg="get_scidx_file: retry_get function call wrong")
        self.assertEqual(bucket_mock_calls[0] ,{'u': 'randomUri', 'f': 'get_key'},msg="get_scidx_file: bucket call wrong")
        self.assertEqual(isInstanceMockTrue_calls[0]['b'], "<class 'a2pyutils.tempfilecache.CacheMiss'>",msg="get_scidx_file: is intance called wrong")
        self.assertEqual(file_cache_mock_calls[0],{'u': 'randomUri', 'f': 'fetch'},msg="get_scidx_file: file cache call wrong")
        self.assertEqual(len(exitErr.mock_calls),0,msg="get_scidx_file: expected no errors ")
    
    def test_write_image_raise(self, ):
        global readFromIndexRaise_calls
        from soundscape.set_visual_scale_lib import write_image
        exitErr = MagicMock()
        readFromIndex = Mock(side_effect=IOError)
        with mock.patch('soundscape.set_visual_scale_lib.exit_error', exitErr, create=False):
            with mock.patch('soundscape.set_visual_scale_lib.soundscape.Soundscape.read_from_index',readFromIndex,create=False):
                write_image('/a/image/file.png',{'path':'/scidx/index/path/file.scidx'},None,1)

        readFromIndex.assert_any_calls('/scidx/index/path/file.scidx')
        exitErr.assert_any_calls('cannot write image file.')
        
    def test_write_image(self, ):
        global readFromIndexRaise_calls
        global sCapeMock_calls
        from soundscape.set_visual_scale_lib import write_image
        exitErr = MagicMock()
        readFromIndex = MagicMock()
        sCapeMockObj = sCapeMock()
        readFromIndex.return_value = sCapeMockObj
        getPalette = MagicMock()
        getPalette.return_value = 'palette return value matrix'
        with mock.patch('soundscape.set_visual_scale_lib.exit_error', exitErr, create=False):
            with mock.patch('soundscape.set_visual_scale_lib.soundscape.Soundscape.read_from_index',readFromIndex,create=False):
                with mock.patch('soundscape.set_visual_scale_lib.a2pyutils.palette.get_palette',getPalette,create=False):
                    write_image('/a/image/file.png',{'path':'/scidx/index/path/file.scidx'},None,'matrix return value matrix')

        readFromIndex.assert_any_call('/scidx/index/path/file.scidx')
        self.assertEqual(0,len(exitErr.mock_calls),msg="write_image: no errors expected")
        self.assertEqual(sCapeMock_calls[0],{'p': 'palette return value matrix', 'file': '/a/image/file.png', 'f': 'write_image'},msg="write_image: Soundscape mock calls are wrong")
        getPalette.assert_any_call('matrix return value matrix')
    
    def test_upload_image_raise(self):
        global bucket_mock_calls
        global keyMockCalls
        keyMockCalls = []
        bucket_mock_calls = []
        from soundscape.set_visual_scale_lib import upload_image
        exitErr = MagicMock()
        bucketMock = bucket_mock(True)
        with mock.patch('soundscape.set_visual_scale_lib.exit_error', exitErr, create=False):
            upload_image('/any/image/uri','/any/image/path',bucketMock)
        exitErr.assert_any_calls('cannot upload image file.')
        self.assertEqual(bucket_mock_calls[0],{'u': '/any/image/uri', 'f': 'new_key'},msg="upload_image_raise: wrong bucket call")
        self.assertEqual(0,len(keyMockCalls),msg="upload_image_raise: no calls expected to key functions")

    def test_upload_image(self):
        global bucket_mock_calls
        global keyMockCalls
        keyMockCalls = []
        bucket_mock_calls = []
        from soundscape.set_visual_scale_lib import upload_image
        exitErr = MagicMock()
        bucketMock = bucket_mock(False)
        with mock.patch('soundscape.set_visual_scale_lib.exit_error', exitErr, create=False):
            upload_image('/any/image/uri','/any/image/path',bucketMock)
        self.assertEqual(bucket_mock_calls[0],{'u': '/any/image/uri', 'f': 'new_key'},msg="upload_image: wrong bucket call")
        self.assertEqual(keyMockCalls,[{'u': '/any/image/path', 'f': 'set_contents_from_filename'}, {'u': 'public-read', 'f': 'set_acl'}],msg="upload_image: wrong key calls")
        self.assertEqual(0,len(exitErr.mock_calls),msg="upload_image: no errors expected")
    
    def test_update_db(self):
        global close_obj_calls
        global mock_closing_calls
        close_obj_calls = []
        mock_closing_calls = []
        from soundscape.set_visual_scale_lib import update_db
        with mock.patch('contextlib.closing', mock_closing , create=False):
            dbMock = db_mock()
            update_db(dbMock,1, 2, 3, 4)
        correctCalls= [{'q': '\n                UPDATE `soundscapes`\n                SET visual_max_value = %s, visual_palette = %s,\n                    normalized = %s\n                WHERE soundscape_id = %s\n            ', 'a': [1, 2, 4, 3], 'f': 'execute'}, {'f': 'close'}]
        self.assertEqual(close_obj_calls,correctCalls,msg="update_db: incorrect calls sequence")

sys_exit_calls = []
class sys_exit:
    def __init__(self):
        pass
    def exit(self):
        global sys_exit_calls
        sys_exit_calls.append({'f':'exit'})
    
outputstringcorrect = """    soundscape_id - id of the soundscape whose image to edit
    max_visual_scale - clip range maximum (if '-', then it is
                       computed automatically)
    palette_id - index of the gradient palette to use
                (defined in a2pyutils.palette)"""

run_mock_calls = []
def run_mock(a,b,c,d):
    global run_mock_calls
    run_mock_calls.append([a,b,c,d])
    
class Test_set_visual_scale(unittest.TestCase):
    def test_file_can_be_called(self):
        from cStringIO import StringIO
        import sys
        import imp
        global sys_exit_calls
        output = StringIO()
        saved_stdout = sys.stdout
        sys.stdout = output
        set_visual_scale = imp.load_source('set_visual_scale', 'scripts/Soundscapes/set_visual_scale.py')
        set_visual_scale.sys = sys_exit()
        set_visual_scale.main([])
        outputString = output.getvalue()
        output.close()
        sys.stdout = saved_stdout
        self.assertEqual(sys_exit_calls[0],{'f': 'exit'},msg="incorrect sys exit call")
        self.assertTrue(outputstringcorrect in outputString,msg="file_can_be_called: Incorrect output message")
        
    def test_file_can_be_called_with_args(self):
        from cStringIO import StringIO
        import sys
        import imp
        global sys_exit_calls
        global run_mock_calls
        run_mock_calls = []
        sys_exit_calls = []
        output = StringIO()
        saved_stdout = sys.stdout
        sys.stdout = output
        set_visual_scale = imp.load_source('set_visual_scale', 'scripts/Soundscapes/set_visual_scale.py')
        set_visual_scale.sys = sys_exit()
        set_visual_scale.a2pyutils.palette.palette = [1]
        set_visual_scale.run = run_mock
        set_visual_scale.main([1,2,3,0])
        outputString = output.getvalue()
        output.close()
        sys.stdout = saved_stdout
        self.assertEqual(len(sys_exit_calls),0,msg="no exit calls expected")
        self.assertEqual(run_mock_calls[0],[2, 3, 0, 0],msg="incorrect call to run function")
        self.assertEqual('end\n',outputString,msg="file_can_be_called: Incorrect output message")
        
if __name__ == '__main__':
    unittest.main()
