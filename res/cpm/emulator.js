
function extend(subClass, baseClass) {
  function inheritance() { }
  inheritance.prototype          = baseClass.prototype;
  subClass.prototype             = new inheritance();
  subClass.prototype.constructor = subClass;
  subClass.prototype.superClass  = baseClass.prototype;
};

function Emulator(container) {
  this.superClass.constructor.call(this, container);
  this.doInit();
};
extend(Emulator, VT100);
Emulator.prototype.gotoState = function() {
 
    this.nextTimer = setTimeout(function(emulator) {
                                  return function() {
                                    emulator.doExec();
                                  }
                                }(this), 0);
  
};



function hello(){
	
}

Emulator.prototype.doInit = function() {

    this.memio  = new Memio(
    function(vt){return function(c){vt.vt100(c)}}(this),      //out
	
    function(vt){return function(){
	var c = vt.keys.charAt(0); //in
	vt.keys = '';
    return c.charCodeAt(0) & 0x7f}
    }(this),
	
    function(vt){return function(){
	var s = vt.keys.length>0;  //status
     vt.waitloop = s ? 0 : vt.waitloop+1;
     return s;
	}}(this),
	
    function(vt){return function(c){vt.sendToPrinter(c)}}(this)//printer
    );
  // init the CPU here
  this.cpu = new Cpu(this.memio, null);
  this.addr = this.cpu.pc;
  this.instrcnt = 640; // 640 ~ 2MHz
  this.waitloop = 0;
 

  var drv = 0;
  var addr = 0;
  this.memio.readSector(drv, 0, 1, addr);
  this.cpu.pc = addr;
  this.io_op = 4; // wait for disk io completion

  this.keys = '';
  this.line = '';

  this.doExec();
  return false;
};






Emulator.prototype.doExec = function() {

  for (var i = 0; i < this.instrcnt; ++i) { // number of instructions not cycles!
 this.cpu.step()
   }
  this.gotoState();
  return true;
};




Emulator.prototype.keysPressed = function(ch) {
  if (this.state == 5 /* STATE_EXEC */) {
    for (var i = 0; i < ch.length; i++) {
      var c  = ch.charAt(i);
      if (c =='\u000e') {
        this.keys = '';
        this.error('Interrupted');
	this.vt100('^.\r\n');
        return;
      }
      this.keys += c;
    }
  }
  this.keys += ch;
 this.gotoState(this.state);
};

