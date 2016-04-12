var Client = require('node-rest-client').Client
var dbWriter = require('dbWriter.js')

var crewInfo = {
  fleet : "bitfinex",
  starship : "btc",
  ext: ".second",
  depthSize: 20,
  priceScale: 100, 
  amountScale: 1000000,
  depthSupplyInfo: undefined,
  tradeSupplyInfo: undefined,
};

var client = new Client();
var nextDepth = 0;
var lastTrade = 0;
var depthUrl = "https://api.bitfinex.com/v1/book/BTCUSD?limit_asks=20&limit_bids=20";
var tradeUrl = "https://api.bitfinex.com/v1/trades/BTCUSD?timestamp="

/// Process depth info
processDepth = function(data, response) {
  var timestamp = Date.now();
  var depth = {
    timestamp: timestamp,
    asks: [],
    bids: []
  }
  
  for (var i = 0 ; i < crewInfo.depthSize; ++i) {
    depth.asks.push([data.asks[i]['price'], data.asks[i].amount]);
    depth.bids.push([data.bids[i]['price'], data.bids[i].amount]);
  }
  dbWriter.dbWriteDepth(crewInfo, depth); 
};

/// Get depth every second
getDepth = function() {
  var timestamp = Date.now();
  if (timestamp < nextDepth) {
    return;
  }
  if (nextDepth == 0) {
    nextDepth = Math.floor(timestamp/1000)*1000 + 1000;
    return;
  }
  timestamp = Math.floor(timestamp/1000)*1000;
  nextDepth = timestamp + 1000;
  var req = client.get(depthUrl, processDepth);
  req.on('error', function(err) {
    console.log(err);
  });
};

/// Process trade info
processTrade = function(data, response) {
  var tradeArray = [];
  for (var i = data.length - 1; i >= 0; --i) {
    var timestamp = data[i]['timestamp'];
    if (timestamp == lastTrade) {
      continue;
    }
    lastTrade = timestamp;
    var isBid = 0;
    if (data[i].type == 'buy') {
      isBid = 1;
    }
    tradeArray.push([timestamp * 1000, isBid, data[i].price, data[i].amount]);
  }
  if (tradeArray.length > 0) {
    var trades = {
      timestamp: lastTrade*1000,
      trades : tradeArray 
    }
    dbWriter.dbWriteTrades(crewInfo, trades); 
  }

}

/// Get trade every time is called
getTrade = function() {
  if (lastTrade > 0) {
    var req = client.get(tradeUrl + lastTrade, processTrade);
    req.on('error', function(err) {
      console.log(err);
    });
  }
}

var intervalDepth = setInterval(getDepth, 10);
var intervalTrade = setInterval(getTrade, 60000);

// get trade for startpoint
client.get("https://api.bitfinex.com/v1/trades/BTCUSD?limit_trades=1", function(data, response) {
      lastTrade = data[0]['timestamp']
      console.log(lastTrade);
});
