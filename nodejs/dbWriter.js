var sqlite3 = require('sqlite3').verbose()
var expandHomeDir = require('expand-home-dir')
var mkdirp = require('mkdirp')

HOUR = 60*60*1000;

function pad0(input, width) {
  return input.length >= width ? input
                               : new Array(width - input.length + 1).join('0') + input; 
};

/// Return supply label for current timestamp
/// Writing to ~/dock/xx_exchange/xx_item/month/data/hour.supplyname.db
function getSupplyInfo(info, timestamp, filename) {
  var date = new Date(timestamp)
  var year = date.getFullYear()
  var month = date.getMonth() + 1
  var day = date.getDate()
  var hour = date.getHours()

  month = pad0(month.toString(), 2)
  day = pad0(day.toString(), 2)
  hour = pad0(hour.toString(), 2)
  
  var ret = {
    compartment: year + "-" + month,
    crate: year + "-" + month + "-" + day,
    supply: year + "-" + month + "-" + day + "-" + hour,
    start: timestamp - timestamp%HOUR,
    end: timestamp - timestamp%HOUR + HOUR
  } 
  ret.dir = expandHomeDir('~/dock/') + info.fleet + "/" + info.starship + "/" + ret.compartment + "/" + ret.crate 
  ret.file = ret.dir + "/" + ret.supply + filename
  return(ret)
};

/// Create new supply db for this timestamp
function createDepthDb(info, timestamp) {
  info.depthSupplyInfo = getSupplyInfo(info, timestamp, ".depth" + info.ext + ".db")
  var curLabel = info.depthSupplyInfo

  // mkdir and get db connection
  mkdirp.sync(curLabel.dir)
  info.depthSupplyInfo.db = new sqlite3.Database(curLabel.file)

  var db = info.depthSupplyInfo.db 
  db.serialize(function() {
    // Create config table
    db.run("CREATE TABLE IF NOT EXISTS config (Timestamp INT PRIMARY KEY, Unit TEXT, Offset INT, Size INT, PriceScale INT, AmountScale INT)");
    var configString = "INSERT OR REPLACE INTO config VALUES("; 
    configString += curLabel.start + ","
    configString += '"ms",1,'
    configString += info.depthSize + ","
    configString += info.priceScale + ","
    configString += info.amountScale + ")"
    db.run(configString)
  
    // Create data table   
    var dataTableString = "CREATE TABLE IF NOT EXISTS data (Timestamp INT PRIMARY KEY";
    for (var i = 0; i < info.depthSize; ++i) {
      dataTableString+= ",B" + i + "p,B" + i + "a,A" + i + "p,A" + i + "a";
    }
    dataTableString += ")";
    db.run(dataTableString)
  });
}

/// Create new supply db for this timestamp
function createTradeDb(info, timestamp) {
  info.tradeSupplyInfo = getSupplyInfo(info, timestamp, ".trade" + info.ext + ".db")
  var curLabel = info.tradeSupplyInfo

  // mkdir and get db connection
  mkdirp.sync(curLabel.dir)
  info.tradeSupplyInfo.db = new sqlite3.Database(curLabel.file)
  var db = info.tradeSupplyInfo.db 
  db.serialize(function() {
    // Create config table
    db.run("CREATE TABLE IF NOT EXISTS config (Timestamp INT PRIMARY KEY, Unit TEXT, Offset INT, PriceScale INT, AmountScale INT)");
    var configString = "INSERT OR REPLACE INTO config VALUES("; 
    configString += curLabel.start + ","
    configString += '"ms",1,'
    configString += info.priceScale + ","
    configString += info.amountScale + ")"
    db.run(configString)
    // Create data table
    db.run("CREATE TABLE IF NOT EXISTS data (Timestamp INT, isBid INT, Price INT, Amount INT)")
  });
}

//// -------------- exports ----------------
module.exports = {

dbWriteDepth : function(info, depth) {
  var timestamp = depth.timestamp
  // check if need to start with a new db
  if (!info.depthSupplyInfo || timestamp > info.depthSupplyInfo.end) {
    if (info.depthSupplyInfo && info.depthSupplyInfo.db) {
      info.depthSupplyInfo.db.close()
    }
    createDepthDb(info, timestamp)
  }
  // write it
  var insertString = "INSERT OR REPLACE INTO data VALUES (" ;
  insertString += timestamp - info.depthSupplyInfo.start
  for (var i = 0; i < info.depthSize; ++i) {
    var bidPrice = Math.round (info.priceScale*depth.bids[i][0])
    var bidAmount = Math.round (info.amountScale*depth.bids[i][1])
    var askPrice = Math.round (info.priceScale*depth.asks[i][0])
    var askAmount = Math.round (info.amountScale*depth.asks[i][1])
    insertString += "," + bidPrice + "," + bidAmount + "," + askPrice + "," + askAmount;
  }
  insertString += ")";
  info.depthSupplyInfo.db.run(insertString) 
},

dbWriteTrades : function(info, trades) {
  if (trades.length <= 0) {
    return;
  }

  // check if need to start with a new db
  var timestamp = trades.timestamp
  if (!info.tradeSupplyInfo || timestamp > info.tradeSupplyInfo.end) {
    if (info.tradeSupplyInfo && info.tradeSupplyInfo.db) {
      info.tradeSupplyInfo.db.close()
    }
    createTradeDb(info, timestamp)
  }
  // write it
  insertString = "INSERT INTO data VALUES" 
  timeOffset = info.tradeSupplyInfo.start
  for (var i = 0; i < trades.trades.length; ++i ) {
    if (i > 0) {
      insertString += ","
    }
    var curtimestamp = trades.trades[i][0] - timeOffset;
    var isBid = trades.trades[i][1];
    var price = Math.round(info.priceScale*trades.trades[i][2]);
    var amount = Math.round(info.amountScale*trades.trades[i][3]);
    insertString += '(' + curtimestamp + ',' + isBid + ',' + price + ',' + amount + ')';
  }
  insertString +=";"
  info.tradeSupplyInfo.db.run(insertString);
}

} // end export
