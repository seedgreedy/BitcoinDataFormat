# Bitcoin Data Format
The repository contains examples how Blacksid stores Bitcoin order book and order flow data

## Design
Data are broken down to hours, and stored in sqlite for easy transfer.

## Path
Starship analogy
* **Dock**: the server or pc that stores data
* **Fleet**: exchange
* **Startship**: item such as btc,ltc,eth within the fleet
* **Monthly Compartment**: contains data for whole month
* **Daily Crate**: contains data for the day
* **Supply**: individual files inside crates
* **Crew**: the program used to fill in supplies

Path
```
dock/{{fleet}}/{{starship}}/{{month}}/{{day}}/{{hour}}.{{supply}}.db
```
Example
```
dock/okcoin_cn/btc/2016-03/2016-03-03/2016-03-03-20.depth.db
```

## Supplies
In order to save space, both order book and order flow db save data only in INT (2~8bytes).
* Unix timestamp is long, but we only save the offset to the hour.
* Price, amount are doub,e but we multiply a scale to allow us store only INT.

### depth.db
Order book snapshots
* Table **Config**
 * Timestamp: timestamp of the start of the hour. Note that the date in the path may subject to timezone.
 * Unit: unit of the timestamp, usually ms or s
 * Offset: 1 means timestamp stored in data table is an offset from the starthour
 * Size: how many entries on each side of the order book 
 * PriceScale: scale of the price data in data table. For example scale 100, data stored 123456, actual is 1234.56
 * AmountScale: scale of the amount data in data table. For example scale 10000, data stored 123456, actual is 12345600
* Table **Data**
 * Timestamp: offset stored, actual tiemstamp = config.timestamp + data.timestamp
 * Sequence: B0p,B0a,A0p,A0a,B1p ...
 * B0p, B0a: highest bid, p for scaled price, a for scaled amount
 * A0p, A1a: lowest ask, p for scaled price, a for scaled amount
 * B1,A1,B2,A2...: 2nd highest/lowest, 3rd highest/lowest ...

### trade.db
Order flow
* Table **Config**: similar  to depth.db.config except there is no “Size"
* Table **Data**:
 * Timestamp: same as depth.db.data.timestamp
 * isBid: 1 if the order is bidding, 0 if askking
 * Price/Amount: scaled price an amount
