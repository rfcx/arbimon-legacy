import os
import tempfile
from time import gmtime, strftime

class Logger:

    def __init__(self,jobId,script,logFor='worker',logON = True):
        self.logON = logON
        self.also_print = False
        if self.logON:
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
        if self.logON:
            currTime = strftime("%Y-%m-%d %H:%M:%S", gmtime())
            if self.log_file_handle:
                self.log_file_handle.write(currTime +':\t'+message+'\n')
            else :
                self.log_file_handle = open(self.filePath,'a')
                self.log_file_handle.write(currTime +':\t'+message+'\n')
            if self.log_file_handle:
                self.log_file_handle.close()
                self.log_file_handle = None
            if self.also_print:
                print "#LOG:" + currTime + ':\t'+message

    def time_delta(self, message, start):
        self.write("{} --- seconds --- {}".format(
            msg, time.time() - start
        ))


    def write_clean(self,message):
        if self.logON:
            self.log_file_handle.write(message)
    
    def close(self):
        if self.logON:
            if self.log_file_handle:
                self.write('end of log')
                self.log_file_handle.close()
                
    def __exit__(self, type, value, traceback):
        if self.logON:
            if self.log_file_handle:
                self.write('end of log')
                self.log_file_handle.close()
