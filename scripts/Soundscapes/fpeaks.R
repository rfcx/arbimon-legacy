args = commandArgs(TRUE)
suppressMessages(suppressWarnings(library(seewave)))
suppressMessages(suppressWarnings(library(tuneR)))
archivo<- readWave(args[1])
AmplPeaks = c()
if(length(archivo@left)>0)
{ 
    picos = c()
    spec = c()
    
    tryCatch(
        {
            spec <- meanspec(archivo, f=44100, plot=FALSE,wl=512)
        }
        ,
        error = function(e)
        {
            cat ('err')
            quit()
        }
    );
    tryCatch(
        {
            if(args[2] == 'p')
            {
                picos<-fpeaks(spec,amp=c(0.01,0.01),freq=86,plot=FALSE,threshold=as.numeric(args[3]))
            }
            if(args[2] == 'a')
            {
                picos<-fpeaks(spec,freq=86,plot=FALSE,threshold=as.numeric(args[3]))
            }
        }
        ,
        error = function(e)
        {
            cat ('err')
            quit()
        }
    );
    
    if( is.na(picos) || length(picos) < 1)
    {
       cat('err')
    }
    else
    {
       picos[is.na(picos)]<-0
       p<-dim(picos)
       if (p[1]>=1)
       {
           pico<-data.frame(picos)
           AmplPeaks<-lapply(1:length(pico[,1]),
                               function (ii)
                               {
                                   cat(pico[ii,1])
                                   cat(',')
                               }
                           )
       }else cat ('err')
    }      

}else cat ('err')

