function pad(str, n) {
  var r = [];
  for(var i=0; i < (n - str.length); ++i)
    r.push("0");
  r.push(str);
  return r.join("");
}


function Memio(conso, consi, conss, prn)
{
  // reset and initialize RAM
  this.ram = new Array(65536);
  for (var i=0; i < this.ram.length; ++i)
    this.ram[i] = 0;
  // reset io components
  this.db = null; // SQLite db connection for drives and sectors
  this.drv = 0; // A:
  this.trk = 0;
  this.sec = 1; // sector numbers start at 1
  this.dma = 0x0000;
  this.dskstat = 0; // diskstatus
  this.iocount = 0; // number of pending requests
  this.writeCompleteCB = null; // will be called after drive formatting
  this.drives = [{tracks:77, sectors:26, name:"dsk0.cpm"},
                 {tracks:77, sectors:26, name:"dsk1.cpm"},
                 {tracks:77, sectors:26, name:"dsk2.cpm"},
                 {tracks:77, sectors:26, name:"dsk3.cpm"}];

  this.cBuf= new Array(128); // for 4FDC
  this.cNxt= 0;
  this.cDrq= 0;
  this.cDone=0;

  // store console in and out functions
  this.co = conso; //out
  this.ci = consi; //in
  this.cs = conss; //status
  this.pr = prn;   //printer out
  //
  //this.initTape();
  //this.initPuncher();
  //this.dumpdata = "";
}

Memio.prototype.rd = function(a) {
  return this.ram[a];
}

Memio.prototype.wr = function(a, b) {
  this.ram[a & 0xffff] = b & 0xff;
  return b;
}




// ---------------------------------------------
// IO Subsystem
// ---------------------------------------------
Memio.prototype.input = function(port) {
  // port 0 is console status (0xff == input avail, else 00)
  // port 1 is console input
  switch (port) {
  case 0:
    return this.cs() ? 0xff : 0x00;
    break;
  case 1:
    return this.ci();
    break;
  case 4:
    return 0xff; // always input avail (at least CTRL-Z)
    break;
  case 5:  // auxin == paper tape
    if (this.tapepos >= this.tape.length) return 0x1a; // CTRL-Z
    return this.tape.charCodeAt(this.tapepos++) & 0xff;
    break;
  case 10: // 0x0a FDC drive
    return this.drv;
    break;
  case 11: // 0x0b FDC track
    return this.trk;
    break;
  case 12: // 0x0c FDC sector
    return this.sec;
    break;
  case 13: // 0x0d FDC command IO ready?
    return this.iocount == 0 ? 0xff : 0x00;
    break;
  case 14: // 0x0e FDC status
    return this.dskstatus;
    break;
  case 15: // 0x0f DMA low
    return this.dma & 0xff;
    break;
  case 16: // 0x10 DMA high
    return (this.dma & 0xff00) >> 8;
    break;
  }
  return 0x1a; // Ctrl-Z to simulate EOF
}

Memio.prototype.output = function(port, value) {
//this.co("output "+port+"="+value+":");
  switch (port) {
  case 1: // console out
    this.co(String.fromCharCode(value));
    break;
  case 3: // printer out
    this.pr(String.fromCharCode(value));
    break;
  case 4: // rewind tape (aux)
    if (value & 0x01) this.rewindTape();
    break;
  case 5: // aux out
    this.puncher += String.fromCharCode(value);
    break;
  case 10: // 0x0a FDC drive
    this.drv = value & 0xff;
    break;
  case 11: // 0x0b FDC track
    this.trk = value & 0xff;
    break;
  case 12: // 0x0c FDC sector
    this.sec = value & 0xff;
    break;
  case 13: // 0x0d FDC command
    if (this.drv >= this.drives.length) {
      this.dskstatus = 1; // illegal drive
      return null;
    }
    if (this.trk >= this.drives[this.drv].tracks) {
      this.dskstatus = 2; // illegal track
      return null;
    }
    if (this.sec == 0 || this.sec > this.drives[this.drv].sectors) {
      this.dskstatus = 3; // illegal sector
      return null;
    }
    if (value == 0) {        // read
      if (this.dma > this.ram.length - 128) {
	this.dskstatus = 5;  // read error
      } else {
	this.readSector(this.drv, this.trk, this.sec, this.dma, this.dma + 128);
	// dskstatus set by readSector
      }
    } else if (value == 1) { // write
      if (this.dma > this.ram.length - 128) {
	this.dskstatus = 6;  // write error
      } else {
	this.writeSector(this.drv, this.trk, this.sec, this.dma, this.dma + 128);
	// dskstatus set by writeSector
      }
    } else {
      this.dskstatus = 7;    // illegal command
    }
    break;
  case 15: // 0x0f DMA low
    this.dma = (this.dma & 0xff00) | (value & 0xff);
    break;
  case 16: // 0x10 DMA high
    this.dma = (this.dma & 0x00ff) | ((value & 0xff) << 8);
    break;
  }
  return null;
}






Memio.prototype.callCB = function(res) {
  var cb = this.writeCompleteCB; 
  if (cb) {
    this.writeCompleteCB = null;
    cb(res);
  }
}

Memio.prototype._writeSector = function(drv, trk, sec, data, dirty) {
  var memio = this;
  this.iocount += 1;
  
  	var bts = ((trk*26) + (sec-1)) * 128;
	  for (var i = 0; i < 128; ++i){
	  arr[bts +i] = data[i];
	 }
	 
    memio.iocount -= 1;
	memio.dskstat = 0;
	if (memio.iocount == 0) memio.callCB(true);
}

Memio.prototype.writeSector = function(drv, trk, sec, dma, end) {
  var data = this.ram.slice(dma, end);
  this._writeSector(drv, trk, sec, data, 1); // dirty write
}


Memio.prototype.readSector = function(drv, trk, sec, dma) {
  var memio = this;
  this.iocount += 1;
	  var bts = ((trk*26) + (sec-1)) * 128;
	  for (var i = 0; i < 128; ++i){
	  memio.ram[dma+i] =arr[bts +i];
	  }
	  memio.iocount -= 1;
	  memio.dskstat = 0;	
}

