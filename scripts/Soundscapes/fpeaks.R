args = commandArgs(TRUE)
suppressMessages(suppressWarnings(library(seewave)))
suppressMessages(suppressWarnings(library(tuneR)))
archivo<- readWave(args[1])
AmplPeaks = c()
if(length(archivo@left)>archivo@samp.rate)# at least one second of audio
{
    bin_size = as.numeric(args[3])
    picos = c()
    spec = c()
    srate = archivo@samp.rate
    n = floor((srate)/bin_size) # search for the next power of two
    n = n - 1
    n = bitwOr(n,bitwShiftR(n, 1) )
    n = bitwOr(n,bitwShiftR(n, 2)  )
    n = bitwOr(n,bitwShiftR(n, 4) )
    n = bitwOr(n,bitwShiftR(n, 8) )
    n = bitwOr(n,bitwShiftR(n, 16) )
    windowsize = n + 1
    tryCatch(
        {
            spec <- meanspec(archivo, f=srate, plot=FALSE,wl=windowsize)
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
            #,amp=c(0.01,0.01)
            picos<-fpeaks(spec,freq=as.numeric(args[4]),plot=FALSE,threshold=as.numeric(args[2]))
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

