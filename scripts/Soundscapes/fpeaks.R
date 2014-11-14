cat('started\n')
args = commandArgs(TRUE)
library(seewave)
library(tuneR)
archivo<- readWave(args[1])
AmplPeaks = c()
if(length(archivo@left)>0)
{ 

    spec <- meanspec(archivo, f=44100, plot=FALSE)
    
    if(args[2] == 't')
        picos<-fpeaks(spec,threshold=.5,freq=86) #con threshold
    if(args[2] == 'p')
        picos<-fpeaks(spec,amp=c(0.01,0.01),freq=86) #PENDIENTE
    if(args[2] == 'a')
        picos<-fpeaks(spec,freq=86,plot=FALSE)#no tiene threshold y amp
        
    picos[is.na(picos)]<-0
    p<-dim(picos)
    if (p[1]>=1)
    {
        pico<-data.frame(picos)
    
        AmplPeaks<-lapply(1:length(pico[,1]),
                            function (ii)
                            {
                                f<-pico[ii,1]			
                                Amplitud<-pico[ii,2]	
                                PeaksFrec=f
                                aa=cbind(PeaksFrec,Amplitud)
                            }
                        )
    }
}
AmplPeaks
length(AmplPeaks)