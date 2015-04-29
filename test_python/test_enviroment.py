import unittest
import imp
import json
import importlib

def load(lib):
    path = None
    flag = False
    try:
        fp,path,desc = imp.find_module(lib)
        path = 'found'
    except:
	flag = True
    if flag:
        try:
	    i = importlib.import_module(lib)
	    path = 'found'
        except:
	    """do nothing"""
    return path
    
class Test_enviroment(unittest.TestCase):
    def test_libs_imports(self):
        libs = None
        with open('test_python/data/libs.json') as fd:
            libs = json.load(fd)
        for i in libs:
            self.assertEqual(load(i),'found',msg="Lib "+i+" is not installed in current enviroment")

if __name__ == '__main__':
    unittest.main()
