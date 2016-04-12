require(RSQLite)
require(data.table)

#' Read in depth from a file
#' @param filename Depth db name
#' @param verbose True to print info message
#' @param matrix True to return a matrix instead
#' @return a data.table contains the depth data
db_readDepthHour = function(filename, verbose = TRUE, matrix = TRUE) {
  if (verbose) {
    cat("Reading depth: ", filename, "\n")
  }
  
  # connect now 
  result = tryCatch({
    dbConnection <- dbConnect(SQLite(), filename, flags = SQLITE_RO)
    
    ret <- NULL
    # read config
    configs <- db_readDbConfig(dbConnection)
    timeOffset <- configs[1,1]
    depthSize <- configs[1,5]
    priceScale <- configs[1,6]
    amountScale <-configs[1,7]
    depthSizes <- seq(1, depthSize)
    
    # read data
    resultSet <- dbSendQuery(dbConnection, "SELECT * FROM Data")
    data <- dbFetch(resultSet, n = -1)
    
    dbClearResult(resultSet)
    
    # process: timestamp, bid1Price, bid1Amount, ask1Price, ask1Amount, bid2Price ...
    priceIndex <- seq(2, 2+depthSize*2*2-1, 2)
    amountIndex <- seq(3, 3+depthSize*2*2-1, 2)
    data[,'Timestamp'] <- data[, 'Timestamp'] + timeOffset
    data[,priceIndex] <- data[, priceIndex] / priceScale
    data[,amountIndex] <- data[, amountIndex] / amountScale
    
    names <- c("timestamp")
    for ( i in depthSizes ){
      names <- c (names,
                 paste0("bid", i, "Price") ,
                 paste0("bid", i, "Amount") ,
                 paste0("ask", i, "Price") ,
                 paste0("ask", i, "Amount") 
                  )
    }
    if (matrix) {
      ret <- data.matrix(data)
    } else {
      ret <- data.table(data) 
    }
    colnames(ret) <- names
    
  }, warning = function(warn) {
    stop("Error: fail to read database file ", warn)
  }, error = function(err) {
    stop("Error: fail to read database file ", err)
  }, finally = function() {
    dbDisconnect(dbConnection)
  }
  ) # end tryCatch
  
  return(ret)
} 

#' Read in trade from a file
#' @param filename Depth db name
#' @param timeAdjust Timestamp adjust in milliseconds
#' @param collapseVolume True to compress same timestamp/type/price into one amount
#' @param verbose True to print info message
#' @param matrix True to return a matrix instead
#' @return a data.table contains the trade data
db_readTradeHour = function(filename,
                            timeAdjust = 0, collapseVolume = FALSE,
                            verbose = TRUE, matrix = TRUE) {
  if (verbose) {
    cat("Reading trade: ", filename, "\n")
  }
  ret <- NULL
  
  # connect now 
  result = tryCatch({
    dbConnection <- dbConnect(SQLite(), filename, flags = SQLITE_RO)
    
    # read config
    configs <- db_readDbConfig(dbConnection)
    timeOffset <- configs[1,1]
    priceScale <- configs[1,5]
    amountScale <-configs[1,6]
    
    # read data
    resultSet <- dbSendQuery(dbConnection, "SELECT * FROM Data WHERE isBid < 2")
    retData <- dbFetch(resultSet, n = -1)
    
    dbClearResult(resultSet)
    
    # process: Timestamp, Price, Amount, isBid
    retData[,"Timestamp"] <- retData[, "Timestamp"] + timeOffset + timeAdjust
    retData[, "Price"] <- retData[, "Price"] / priceScale
    retData[, "Amount"] <- retData[, "Amount"] / amountScale
    # we are returning takeFromBid in boolean
    # bid => takenFromAsk
    # ask => takenFromBid
    # takeFromBid => 1 - isBid
    retData[, "isBid"] <- 1- retData[, "isBid"]
    colnames(retData) <- c("timestamp", "takeFromBid", "price", "volume")
    if (collapseVolume) {
      retData <- data.table(retData)
      retData <- retData[, .(volume = sum(volume)), by=.(timestamp , takeFromBid , price)]
    }
    if (matrix){
      ret <- data.matrix(retData)
    } else {
      ret <- data.table(retData)
    }
    
  }, warning = function(warn) {
    stop("Error: fail to read database file ", warn)
  }, error = function(err) {
    stop("Error: fail to read database file ", err)
  }, finally = function() {
    dbDisconnect(dbConnection)
  }
  ) # end tryCatch
  
  return(ret)
}


##' Read config from a db connection. Internal helper.
##' @param dbConnectoin Connection to the database
##' @return configs
db_readDbConfig = function(dbConnection) {
  # cast timestamp to float to workaround an issue where RSQLite doesn't read in long
  resultSet <- dbSendQuery(dbConnection,
                           "SELECT cast(Timestamp as float), * FROM config")
  configs <- dbFetch(resultSet, 1)
  dbClearResult(resultSet)
  return(configs)
}
