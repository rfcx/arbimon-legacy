import os
import tempfile
from time import gmtime, strftime

class Logger:
    def __init__(self,jobId,script,logFor='worker'):
        tempFolders = tempfile.gettempdir()
        self.workingFolder = tempFolders+"/logs/job_"+str(jobId)
        if not os.path.exists(self.workingFolder):
            os.makedirs(self.workingFolder)
            
        lognametry=0;    
        self.filePath = self.workingFolder+"/"+script+"_"+logFor+"_"+str(lognametry)+".log"
        
        while os.path.isfile(self.filePath):
            lognametry =  lognametry + 1
            self.filePath = self.workingFolder+"/"+script+"_"+logFor+"_"+str(lognametry)+".log"
            
        self.log_file_handle = open(self.filePath,'w')
        self.write(script+' log file')
        self.jobId = jobId
        self.logFor = logFor
    
    def write(self,message):
        currTime = strftime("%Y-%m-%d %H:%M:%S", gmtime())
        self.log_file_handle.write(currTime +':\t'+message+'\n') 
 
    def write_clean(self,message):
        self.log_file_handle.write(message)
    
    def close(self):
        self.write('end of log')
        self.log_file_handle.close()
        
    def __exit__(self, type, value, traceback):
        self.write('end of log')
        self.log_file_handle.close()