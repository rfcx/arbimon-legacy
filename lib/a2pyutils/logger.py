import os
import tempfile
from time import gmtime, strftime

class Logger:

    def __init__(self,jobId,script,logFor='worker',logON = True):
        self.logON = logON
        if self.logON:
            tempFolders = tempfile.gettempdir()
            self.workingFolder = tempFolders+"/logs/classification_"+str(jobId)
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
        if self.logON:
            currTime = strftime("%Y-%m-%d %H:%M:%S", gmtime())
            if self.log_file_handle:
                self.log_file_handle.write(currTime +':\t'+message+'\n')
            else :
                self.log_file_handle = open(self.filePath,'w')
                self.log_file_handle.write(currTime +':\t'+message+'\n')

    def write_clean(self,message):
        if self.logON:
            self.log_file_handle.write(message)
    
    def close(self):
        if self.logON:
            self.write('end of log')
            self.log_file_handle.close()
        
    def __exit__(self, type, value, traceback):
        if self.logON:
            self.log_file_handle.close()
