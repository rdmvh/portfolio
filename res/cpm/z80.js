/*
   File: z80.js
   Release 0.01 Copyright (C) 2017 by Greg Sydney-Smith

   2017-10-24 Greg Sydney-Smith. To Z80, www.sydneysmith.com/products/cpm/z80emu
    Note: Intent is documented Z80 instructions to run CP/M, CDOS, CROMIX.
    See github.com/mamedev/mame/tree/master/src/devices/cpu/z80 for
    undoc instructions and registers needed for later games.
    Also github.com/floooh/yakc/tree/master/src/yakc
   2010-00-11 Stefan Tramm. Modified, www.tramm.li/i8080/
   2008-09-11 Chris Double. Original, www.bluishcoder.co.nz/js8080/
*/
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice,
//    this list of conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES,
// INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
// FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
// DEVELOPERS AND CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
// OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
// WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
// OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
// ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
var CARRY     = 0x01;
var NFLAG     = 0x02;   // 22Oct17. gss. set if last op was subtractioN
var PARITY    = 0x04;
var HALFCARRY = 0x10;
var INTERRUPT = 0x20;
var ZERO      = 0x40;
var SIGN      = 0x80;

// flags
var CF        = 0x01;   // carry
var NF        = 0x02;   // N flag. set if last op was subtractioN
var PF        = 0x04;   // parity even
var VF        = 0x04;   // overflow. flag shared with parity
var XF        = 0x08;   // x
var HF        = 0x10;   // half carry
var YF        = 0x20;   // y
var ZF        = 0x40;   // zero
var SF        = 0x80;   // sign

function Cpu(memio, interrupt)
{
  var i;
  var _szp = [ // sign, zero, parity and others for 0x00-0xFF
     68,  0,  0,  4,  0,  4,  4,  0,  8, 12, 12,  8, 12,  8,  8, 12,
      0,  4,  4,  0,  4,  0,  0,  4, 12,  8,  8, 12,  8, 12, 12,  8,
     32, 36, 36, 32, 36, 32, 32, 36, 44, 40, 40, 44, 40, 44, 44, 40,
     36, 32, 32, 36, 32, 36, 36, 32, 40, 44, 44, 40, 44, 40, 40, 44,
      0,  4,  4,  0,  4,  0,  0,  4, 12,  8,  8, 12,  8, 12, 12,  8,
      4,  0,  0,  4,  0,  4,  4,  0,  8, 12, 12,  8, 12,  8,  8, 12,
     36, 32, 32, 36, 32, 36, 36, 32, 40, 44, 44, 40, 44, 40, 40, 44,
     32, 36, 36, 32, 36, 32, 32, 36, 44, 40, 40, 44, 40, 44, 44, 40,
    128,132,132,128,132,128,128,132,140,136,136,140,136,140,140,136,
    132,128,128,132,128,132,132,128,136,140,140,136,140,136,136,140,
    164,160,160,164,160,164,164,160,168,172,172,168,172,168,168,172,
    160,164,164,160,164,160,160,164,172,168,168,172,168,172,172,168,
    132,128,128,132,128,132,132,128,136,140,140,136,140,136,136,140,
    128,132,132,128,132,128,128,132,140,136,136,140,136,140,140,136,
    160,164,164,160,164,160,160,164,172,168,168,172,168,172,172,168,
    164,160,160,164,160,164,164,160,168,172,172,168,172,168,168,172];

  this.b = 0;
  this.c = 0;
  this.d = 0;
  this.e = 0;
  this.f = 0;
  this.h = 0;
  this.l = 0;
  this.a = 0;
  // 22Oct17. gss. extra z80 registers
  this.b_= 0; // BC'
  this.c_= 0;
  this.d_= 0; // DE'
  this.e_= 0;
  this.h_= 0; // HL'
  this.l_= 0;
  this.a_= 0; // AF'
  this.f_= 0;
  this.ixh=0; // high part of IX, the equiv of H part of HL
  this.ixl=0; // low ...
  this.iyh=0; // high ... of IY, ...
  this.iyl=0;
  this.I = 0;
  this.R = 0;
  //
  this.pc = 0;
  this.sp = 0xF000; // TBD
  this.wz = 0; // undoc; but useful here
  this.memio = memio;
  this.ram = memio.ram; // should only be used by the disass
  this.lastInterrupt = 0x10;
  this.cycles = 0;
  this.interrupt = interrupt;
  this.IFF1 = 0; // ints off
  this.IFF2 = 0;
  this.IM   = 0;
  this.prefix = 0; // 23Oct17. gss. no prefix (CB, ED, DD, FD)

  // initialize possible flag values
  this.szp = [];
  for (i=0; i<_szp.length; i++) this.szp[i]= _szp[i];
}

// gss additions
Cpu.prototype.reset  = function() { this.IFF1= 0; this.IFF2=0; this.IM=0; this.pc=0; this.sp=0xFFFF; }
Cpu.prototype.nmiPin = function() { this.IFF1= 0; this.push(this.pc); this.pc=0x66; } // TODO sync this to after opcode - gss
Cpu.prototype.intPin = function(op) { if (this.IFF1) this.push(this.pc); this.pc=0x38; } // TODO check IM 0 1 2 ... - gss

// read flag bits for conditionals
Cpu.prototype.cf = function() { return this.f & CF; };
Cpu.prototype.nf = function() { return this.f & NF; };
Cpu.prototype.pf = function() { return this.f & PF; };
Cpu.prototype.xf = function() { return this.f & XF; }; // undoc z80 XF, bit 3
Cpu.prototype.hf = function() { return this.f & HF; };
Cpu.prototype.yf = function() { return this.f & YF; }; // undoc z80 YF, bit 5
Cpu.prototype.zf = function() { return this.f & ZF; };
Cpu.prototype.sf = function() { return this.f & SF; };

Cpu.prototype.af = function() {
  return this.a << 8 | this.f;
};

Cpu.prototype.AF = function(n) {
  this.a = n >> 8 & 0xFF;
  this.f = n & 0xFF;
}

Cpu.prototype.bc = function () {
  return this.b << 8 | this.c;
};

Cpu.prototype.BC = function(n) {
  this.b = n >> 8 & 0xFF;
  this.c = n & 0xFF;
}

Cpu.prototype.de = function () {
  return this.d << 8 | this.e;
};

Cpu.prototype.DE = function(n) {
  this.d = n >> 8 & 0xFF;
  this.e = n & 0xFF;
}

Cpu.prototype.hl = function () {
  return this.h << 8 | this.l;
};

Cpu.prototype.HL = function(n) {
  this.h = n >> 8 & 0xFF;
  this.l = n & 0xFF;
};

Cpu.prototype.ix = function () {
  return this.ixh << 8 | this.ixl;
};

Cpu.prototype.IX = function(n) {
  this.ixh = n >> 8 & 0xFF;
  this.ixl = n & 0xFF;
};

Cpu.prototype.iy = function () {
  return this.iyh << 8 | this.iyl;
};

Cpu.prototype.IY = function(n) {
  this.iyh = n >> 8 & 0xFF;
  this.iyl = n & 0xFF;
};

Cpu.prototype.set = function(flag) {
  this.f |= flag;
};

Cpu.prototype.clear = function(flag) {
  this.f &= ~flag & 0xFF ;
};

Cpu.prototype.toString = function() {
  return "{" +
    " af: " + pad(this.af().toString(16),4) +
    " bc: " + pad(this.bc().toString(16),4) +
    " de: " + pad(this.de().toString(16),4) +
    " hl: " + pad(this.hl().toString(16),4) +
    " pc: " + pad(this.pc.toString(16),4) +
    " sp: " + pad(this.sp.toString(16),4) +
    " flags: " +
    (this.f & ZF ? "z" : ".") +
    (this.f & SF ? "s" : ".") +
    (this.f & PF ? "p" : ".") +
    (this.f & CF ? "c" : ".") +
    " " + this.disassemble1(this.pc)[1] +
    " }";
};

Cpu.prototype.cpuStatus = function() {
  var s = "";
  s += " AF:"+pad(this.af().toString(16),4);
  s += " " +
       (this.f & SF ? "s" : ".") +
       (this.f & ZF ? "z" : ".") +
       (this.f & HF ? "h" : ".") +
       (this.f & PF ? "p" : ".") +
       (this.f & CF ? "c" : ".");
  s += " BC:"+pad(this.bc().toString(16),4);
  s += " DE:"+pad(this.de().toString(16),4);
  s += " HL:"+pad(this.hl().toString(16),4);
  s += " (HL):"+pad(this.memio.rd(this.hl()).toString(16),2);
  s += " SP:"+pad(this.sp.toString(16),4);
  s += " PC:"; //+pad(this.pc.toString(16),4);
  s += this.disassemble1(this.pc)[1];
  //s += " [" + this.cycles + "]";
  return s;
}

// Step through one instruction
Cpu.prototype.step = function() {
  var i = this.memio.rd(this.pc++);
  this.pc &= 0xFFFF;
  var r = this.execute(i);
  this.processInterrupts();
  return r;
};

Cpu.prototype.writePort = function (port, v) {
  this.memio.output(port, v);
  return this;
};

Cpu.prototype.readPort = function (port) {
  return this.memio.input(port);
};

Cpu.prototype.r1 = function (addr) {    // read 1 byte fm mem
  return this.memio.rd(addr);
};

Cpu.prototype.r2 = function (addr) {    // read 2 bytes ...
  var l = this.memio.rd(addr);
  var h = this.memio.rd(addr+1);
  return h << 8 | l;
};

Cpu.prototype.r1s = function (addr) {   // read 1 byte, signed (from mem)
  var v= this.memio.rd(addr);
  return (v<128)? v : v-256;            // convert byte to -128..+127 offset

};

Cpu.prototype.next1 = function() {
  var b = this.memio.rd(this.pc++);
  this.pc &= 0xFFFF;
  return b;
};

Cpu.prototype.next1s = function() {
  var v = this.memio.rd(this.pc++);
  this.pc &= 0xFFFF;
  return (v<128)? v : v-256;
};

Cpu.prototype.next2 = function() {
  var pc = this.pc;
  var l = this.memio.rd(pc++);
  var h = this.memio.rd(pc++);
  this.pc = pc & 0xFFFF;
  return h << 8 | l;
};

Cpu.prototype.w1 = function(addr, value) {      // write 1 byte to mem
  var v = value & 0xFF;
  this.memio.wr(addr, v);
  return this;
};

Cpu.prototype.w2 = function(addr, value) {      // write 2 bytes ...
  var l = value;
  var h = value >> 8;
  this.w1(addr, l);
  this.w1(addr+1, h);
  return this;
};

// use this for address arithmetic
Cpu.prototype.add = function(a, b) {
  return (a + b) & 0xffff;
}

// set flags after arithmetic and logical ops
Cpu.prototype.calcFlags = function(v, lhs, rhs) {
  var x = v & 0xFF;

  // calc parity (see Henry S. Warren "Hackers Delight", page 74)
  var y = x ^ (x >> 1);
  y ^= y >> 2;
  y ^= y >> 4;

  this.f &= ~(SF|ZF|HF|PF|CF); // clear these to start with
  if (!(y & 1))             this.f |= PF; // PE
  if (v & 0x80)             this.f |= SF;
  if (!x)                   this.f |= ZF;
  if (((rhs^v)^lhs) & 0x10) this.f |= HF;
  if (v >= 0x100 ||  v < 0) this.f |= CF;
  return x;
}

Cpu.prototype.sziff1 = function(val,iff2) { // z80
    var f = (val)?(val&SF):ZF;
    f |= (val & (YF|XF));
    if (iff2) f |= PF;
    return f;
};

/*
Cpu.prototype.inc1 = function(o) {
  var c = this.f & CF; // carry isnt affected
  var r = this.calcFlags(o+1, o, 1);
  this.f = (this.f & ~CF & 0xFF) | c;
  return r;
};
*/
Cpu.prototype.inc1 = function(v) {      // z80
    var r = (v + 1)&0xFF;
    var f = (r?(r&SF):ZF)|(r&(XF|YF))|((r^v)&HF);
    if (r==0x80) f |= VF;
    this.f = f | (this.f & CF);
    return r;
}

/*
Cpu.prototype.dec1 = function(o) {
  var c = this.f & CF; // carry isnt affected
  var r = this.calcFlags(o-1, o, 1);
  this.f = (this.f & ~CF & 0xFF) | c;
  return r;
};
*/
Cpu.prototype.dec1 = function(v) {      // z80
    var r = (v - 1)&0xFF;
    var f = (r?(r&SF):ZF)|(r&(XF|YF))|((r^v)&HF)|NF;
    if (r==0x7F) f |= VF;
    this.f = f | (this.f & CF);
    return r;
}

Cpu.prototype.addByte = function(lhs, rhs) {
  this.f &= ~NF; // z80
  return this.calcFlags(lhs + rhs, lhs, rhs);
};
Cpu.prototype.add1 = function(a, b) {   // z80 ver of addByte
//#define YAKC_SZ(val) ((val&0xFF)?(val&SF):ZF)
//#define YAKC_SZYXCH(acc,val,res) (YAKC_SZ(res)|(res&(YF|XF))|((res>>8)&CF)|((acc^val^res)&HF))
//#define YAKC_ADD_FLAGS(acc,val,res) (YAKC_SZYXCH(acc,val,res)|((((val^acc^0x80)&(val^res))>>5)&VF))
// was inline void z80::add8(a, b) { // a was implied A. A got set; not returned
    var r = a + b;
//    F = ((((r&0xFF)?(r&SF):ZF)|(r&(YF|XF))|((r>>8)&CF)|((a^b^r)&HF))|((((b^a^0x80)&(b^r))>>5)&VF));
    this.f = (r&0xFF == 0)? ZF : r&SF;
    this.f |= (r&(YF|XF)) | ((r>>8)&CF) | ((a^b^r)&HF) | ((((b^a^0x80)&(b^r))>>5)&VF);
    return r&0xFF;
}

Cpu.prototype.adc1 = function(lhs, rhs) { // 8080
  return this.addByte(lhs, rhs + ((this.f & CF) ? 1 : 0));
};

Cpu.prototype.sub1 = function(lhs, rhs) { // 8080
  this.f |= NF; // added for z80
  return this.calcFlags(lhs - rhs, lhs, rhs);
};

Cpu.prototype.sbc1 = function(lhs, rhs) { // 8080
  return this.sub1(lhs, rhs + ((this.f & CF) ? 1 : 0));
};

Cpu.prototype.andByte = function(lhs, rhs) {
  var x = this.calcFlags(lhs & rhs, lhs, rhs);
  this.f |= HF;
  this.f &= ~CF & 0xFF;
  return x;
};

Cpu.prototype.xorByte = function(lhs, rhs) {
  var x = this.calcFlags(lhs ^ rhs, lhs, rhs);
  this.f |= HF;
  this.f &= ~CF & 0xFF;
  return x;
};

Cpu.prototype.orByte = function(lhs, rhs) {
  var x = this.calcFlags(lhs | rhs, lhs, rhs);
  this.f |= HF;
  this.f &= ~CF & 0xFF;
  return x;
};

Cpu.prototype.add2 = function(a,b) { // ADD nn,nn; 2 bytes 8080+z80
    var r = a + b;
    // flag computation taken from MAME
    this.f = (this.f & (SF|ZF|PF)) |
        (((a^r^b)>>8)&HF)|
        ((r>>16) & CF) | ((r >> 8) & (YF|XF));
    return r&0xFFFF;
}

Cpu.prototype.pop = function() {
  var pc = this.r2(this.sp);
  this.sp = (this.sp + 2) & 0xFFFF;
  return pc;
};

Cpu.prototype.push = function(v) {
  this.sp = (this.sp - 2) & 0xFFFF;
  this.w2(this.sp, v)
};

// Z80 additions:
Cpu.prototype.rlc1 = function(v) { // RLC r // 76543210 -> CF=7 65432107
    var r = (v<<1|v>>7)&0xFF;
    this.f = this.szp[r] | (v>>7 & CF);
    return r;
}
Cpu.prototype.rrc1 = function(v) { // RRC r
  var r= (v>>1 | v<<7)&0xFF;
  this.f= this.szp[r] | (v & CF);
  return r;
}
Cpu.prototype.rl1 = function(v) { // RL r
  var r = (v<<1)&0xFF | (this.f & CF);
  this.f= (v>>7 & CF) | this.szp[r];
  return r;
}
Cpu.prototype.rr1 = function(v) { // RR r
  var r = v>>1 | ((this.f & CF)<<7);
  this.f= (v & CF) | this.szp[r];
  return r;
}
Cpu.prototype.sla1 = function(v) { // SLA r
  var r = (v<<1)&0xFF;
  this.f = (v>>7 & CF) | this.szp[r];
  return r;
}
Cpu.prototype.sra1 = function(v) { // SRA r
  var r = (v>>1) | (v & 0x80);
  this.f= (v & CF) | this.szp[r];
  return r;
}
Cpu.prototype.sll1 = function(v) { // SLL r
  // undocument! sll is identical with sla but inserts a 1 into the LSB
  var r = ((v<<1) | 1) & 0xFF;
  this.f = (v>>7 & CF) | this.szp[r];
  return r;
}
Cpu.prototype.srl1 = function(v) { // SRL r
  var r = val>>1;
  this.f = (v & CF) | this.szp[r];
  return r;
};
Cpu.prototype.bit1 = function(v,m) { // BIT r,n (m=1<<n)
  var r = v & m;
  var f = HF | (r ? (r & SF) : (ZF|PF));
  f |= (v & (YF|XF));
  this.f = f | (this.f & CF);
};
Cpu.prototype.sbc2 = function(a,b) { // SBC HL,rr
  var r = a - b - (this.f & CF);
    // flag computation taken from MAME
  this.f= (((a^r^b)>>8)&HF) | NF |
          ((r>>16)&CF) |
          ((r>>8) & (SF|YF|XF)) |
          ((r & 0xFFFF) ? 0 : ZF) |
          (((b^a) & (a^r)&0x8000)>>13);
  return r&0xFFFF;
};
Cpu.prototype.neg1 = function(a) { // NEG ; A
  return this.sub1(0,a);
};
Cpu.prototype.in_c1 = function() { // IN r,(C)
  var r= this.readPort(this.c);
  this.f= this.szp[r]|(this.f&CF);
  this.cycles+=12;
  return r;
};
Cpu.prototype.rrd = function() { // ignoring WZ
    var addr = this.hl();
    var t1 = this.r1(addr);                     // A =ab, t1=cd
    var t2 = this.a & 0xF;                      // t2=0b; store A low nibble
    this.a = (this.a & 0xF0) | (t1 & 0x0F);     // A =ad;
    t1 = (t1 >> 4) | (t2 << 4);                 // t1=bc; 
    this.w1(addr, t1); // abcd -> adbc. a stays put. bcd rotated right 1 digit/nibble
    this.f = this.szp[this.a] | (this.f & CF);
};
Cpu.prototype.rld = function() {
    var addr = this.hl();
    var t1 = this.r1(addr);             // A =ab, t1=cd
    var t2 = this.a & 0xF;              // t2=0b
    this.a = (this.a & 0xF0) | (t1>>4); // A =ac
    t1 = (t1<<4) | t2;                  // t1=db
    this.w1(addr,t1&0xFF); // abcd -> acdb. a stays put. bcd rotated left 1 digit/nibble
    this.f = this.szp[this.a] | (this.f & CF);
};
//------------------------------------------------------------------------------
Cpu.prototype.ldi = function(x) { // x: 1=LDI, -1=LDD
    this.w1(this.de(),this.r1(this.hl()));
    this.HL(this.hl()+x); // ovfl ok: HL() uses 16bits
    this.DE(this.de()+x);
    this.BC(this.bc()-1);
    this.f = (this.f & (SF|ZF|CF)) | (this.bc()? VF : 0); // ignoring XF YF
};
Cpu.prototype.ldir = function(x) {  // x: 1=LDIR, -1=LDDR
    this.ldi(x);
    this.cycles+=16;
    if (this.bc() != 0) {
        this.pc -= 2;
        this.cycles+= 5;
    }
};
Cpu.prototype.cpi = function(x) { // ignores XF YF WZ
    var r = this.a - this.r1(this.hl());
    this.HL(this.hl()+x); // ovfl ok: HL() uses 16bits
    this.BC(this.bc()-1);
    this.f = NF | (this.f&CF) | ((r&0xFF)?(r&SF):ZF) | // #define YAKC_SZ(val) ((val&0xFF)?(val&SF):ZF)
        (((r & 0xF) > (this.a & 0xF))? HF : 0) |
        (this.bc()? VF : 0);
};
Cpu.prototype.cpir = function(x) { // x: 1=CPIR, -1=CPDR
    this.cpi(x);
    this.cycles+=16;
    if ((this.bc()!=0) && !(this.f&ZF)) { // stops after BC or match to A
        this.pc -= 2;
        this.cycles+= 5;
    }
};
Cpu.prototype.ini = function(x) { // x: 1=INI, -1=IND
    var r= this.readPort(this.c);
    this.w1(this.hl(), r);
    this.HL(this.hl()+x); // ovfl ok: HL() uses 16bits
    this.b--;
    this.f = NF | (this.b? 0 : ZF); // doc'd flags only (Mostek Z80 Manual)
};
Cpu.prototype.inir = function(x) {
    this.ini(x);
    this.cycles+=16;
    if (this.b != 0) {
        this.pc -= 2;
        this.cycles+= 5;
    }
};
Cpu.prototype.outi = function(x) { // x: 1=OUTI, -1=OUTD
    var val = this.r1(this.hl());
    this.HL(this.hl()+x); // ovfl ok: HL() uses 16bits
    this.b--;
    this.writePort(this.c,val);
    this.f = NF | (this.b?0:ZF); // doc'd flags only
};
Cpu.prototype.otir = function(x) { // x: 1=OTIR, -1=OTDR
    this.outi(x);
    this.cycles+=16;
    if (this.b != 0) {
        this.pc -= 2;
        this.cycles+= 5;
    }
};

//------------------------------------------------------------------------------

Cpu.prototype._ixd = function() { // IX+d
  return (this.iy()+this.next1s())&0xFFFF;
};

Cpu.prototype._iyd = function() { // IY+d
  return (this.iy()+this.next1s())&0xFFFF;
};

Cpu.prototype.processInterrupts = function() {
  if (this.cycles < 1000000000)
    return null;
  this.cycles -= 1000000000;
  return null;

  if (this.cycles < 16667)
    return;

  this.cycles -= 16667;
  this.lastInterrupt = 0x08;

  if (this.IFF1) {
    this.push(this.pc);
    this.pc = this.lastInterrupt;
    if (this.interrupt)
      interrupt.apply(this, [this.lastInterrupt]);
  }
};

/*
   prefix/state:
   0 -> CB -> 1
   0 -> ED -> 2
   0 -> DD -> 3
              3 -> FD -> 4
              3 -> CB -> WZ=IX+d; -> 5
   0 -> FD -> 4
              4 -> DD -> 3
              4 -> CB -> WZ=IY+d; -> 5
*/

// returns false for HALT and illegal instr., else returns true
Cpu.prototype.execute = function(i) {
  var next=0;
  var t1, t2, t3;

  switch(this.prefix+i) {
  case 0x000: this.cycles += 4; break; // NOP
  case 0x001: this.BC(this.next2()); this.cycles += 10; break; // LD BC,nn
  case 0x002: this.w1(this.bc(), this.a); this.cycles += 7; break; // LD (BC),A
  case 0x003: this.BC((this.bc() + 1) & 0xFFFF); this.cycles += 6; break; // INC BC
  case 0x004: this.b = this.inc1(this.b); this.cycles += 5; break; // INC  B
  case 0x005: this.b = this.dec1(this.b); this.cycles += 5; break; // DEC  B
  case 0x006: this.b = this.next1(); this.cycles += 7; break; // LD   B,n
  case 0x007: t1 = (this.a & 0x80) >> 7;            // RLCA
              this.f = (this.f & ~CF) | (t1? CF:0);
              this.a = ((this.a << 1) & 0xFE) | t1;
              this.cycles += 4; break;

  // 22Oct17. gss.
  case 0x008: t1=this.a; this.a= this.a_; this.a_=t1; // EX AF,AF'
              t1=this.f; this.f= this.f_; this.f_=t1;
              this.cycles += 4; break;
  
  case 0x009: this.HL(this.add2(this.hl(), this.bc())); this.cycles += 11; break; // ADD  HL,BC
  case 0x00A: this.a = this.r1(this.bc()); this.cycles += 7; break; // LD   A,(BC)
  case 0x00B: this.BC((this.bc() - 1) & 0xFFFF); this.cycles += 6; break; // DEC  BC
  case 0x00C: this.c = this.inc1(this.c); this.cycles += 5; break; // INC  C
  case 0x00D: this.c = this.dec1(this.c); this.cycles += 5; break; // DEC  C
  case 0x00E: this.c = this.next1(); this.cycles += 7; break; // LD C,n
  case 0x00F: t1 = (this.a & 1) << 7;       // RRCA
              this.f = (this.f & ~CF) | (t1? CF:0);
              this.a = ((this.a >> 1) & 0x7F) | t1;
              this.cycles += 4; break;

  // DJNZ doesn't change any flags; not even ZF. Z80.
  case 0x010: t1=this.next1s(); this.cycles+=10; this.b=(this.b-1)&0xFF; if (this.b!=0) { this.pc+=t1; this.cycles+=5; } break; // Z80 DJNZ
  case 0x011: this.DE(this.next2()); this.cycles += 10; break; // LD DE,nn
  case 0x012: this.w1(this.de(), this.a); this.cycles += 7; break; // LD (DE),A
  case 0x013: this.DE((this.de() + 1) & 0xFFFF); this.cycles += 6; break; // INC DE
  case 0x014: this.d = this.inc1(this.d); this.cycles += 5; break; // INC D
  case 0x015: this.d = this.dec1(this.d); this.cycles += 5; break; // DEC D
  case 0x016: this.d = this.next1(); this.cycles += 7; break; // LD D,n
  case 0x017: t1= this.f&CF; t2=this.a&0x80;       // RLA
              this.a= ((this.a<<1) | t1)&0xFF
              this.f= (this.f & ~(HF|NF|CF)) | (t2? CF:0);
              this.cycles += 4; break;

  // 22Oct17. gss. JR offset
  case 0x018: {
      //  JR   nn. n=0 goes to nxt instr. -2 goes to cur one.
      t1= this.next1s(); // 2nd of two bytes for this instruction
      this.pc= (this.pc + t1) & 0xFFFF;
      this.cycles += 12;
    }
    break;

  case 0x019: this.HL(this.add2(this.hl(), this.de())); this.cycles += 11; break; // ADD HL,DE
  case 0x01A: this.a = this.memio.rd(this.de()); this.cycles += 7; break; // LD A,(DE)
  case 0x01B: this.DE((this.de() - 1) & 0xFFFF); this.cycles += 6; break; // DEC DE
  case 0x01C: this.e = this.inc1(this.e); this.cycles += 5; break; // INC E
  case 0x01D: this.e = this.dec1(this.e); this.cycles += 5; break; // DEC E
  case 0x01E: this.e = this.next1(); this.cycles += 7; break; // LD E,n
  case 0x01F:
    {
      // RRA
      var c = (this.f & CARRY) ? 0x80 : 0;
      if(this.a & 1)
	this.f |= CARRY;
      else
	this.f &= ~CARRY & 0xFF;
      this.a = ((this.a >> 1) & 0x7F) | c;
      this.cycles += 4;
    }
    break;

  case 0x020: t1=this.next1s(); t2=11; if (!this.zf()) { this.pc=(this.pc+t1)&0xFFFF; t2=16;} this.cycles+=t2; break; // z80 JR NZ,d
  case 0x021: this.HL(this.next2()); this.cycles += 10; break; // LD HL,nn
  case 0x022: this.w2(this.next2(), this.hl()); this.cycles += 16; break; // LD (nn),HL
  case 0x023: this.HL((this.hl()+1)&0xFFFF); this.cycles += 6; break; // INC HL
  case 0x024: this.h = this.inc1(this.h); this.cycles += 5; break; // INC H
  case 0x025: this.h = this.dec1(this.h); this.cycles += 5; break; // DEC H
  case 0x026: this.h = this.next1(); this.cycles += 7; break; // LD H,n
  case 0x027: // DAA
              t1     = ((this.f & HALFCARRY) || (this.a & 0x0f) > 9) ? 6 : 0;
              this.a = this.calcFlags(this.a+t1, this.a, t1);
              t2     = ((this.f & CARRY) || (this.a & 0xf0) > 0x90) ? 0x60 : 0;
              this.a = this.calcFlags(this.a+t2, this.a, t2);
              this.cycles += 4; break;
  case 0x028: t1=this.r1s(); t2=11; if (this.zf()) { this.pc=(this.pc+t1)&0xFFFF; t2=16; } this.cycles+=t2; break; // z80 JR Z,d
  case 0x029: this.HL(this.add2(this.hl(),this.hl())); this.cycles += 11; break; // ADD HL,HL
  case 0x02A: this.HL(this.r2(this.next2())); this.cycles += 16; break; // LD HL,(nn)
  case 0x02B: this.HL((this.hl()-1)&0xFFFF); this.cycles += 6; break; // DEC HL
  case 0x02C: this.l=this.inc1(this.l); this.cycles += 5; break; // INC L
  case 0x02D: this.l=this.dec1(this.l); this.cycles += 5; break; // DEC L
  case 0x02E: this.l=this.next1(); this.cycles += 7; break; // LD L,n
  case 0x02F: this.a ^= 0xFF; this.cycles += 4; break; // CPL

  case 0x030: t1=this.next1s(); t2=11; if (!this.cf()) { this.pc=(this.pc+t1)&0xFFFF; t2=16; } this.cycles+=t2; break; // z80 JR NC,d
  case 0x031: this.sp = this.next2(); this.cycles += 10; break; // LD SP,nn
  case 0x032: this.w1(this.next2(), this.a); this.cycles += 13; break; // LD (nn),A
  case 0x033: this.sp=(this.sp+1)&0xFFFF; this.cycles += 6; break; // INC SP
  case 0x034: t1=this.hl(); this.w1(t1,this.inc1(this.r1(t1))); this.cycles += 10; break; // INC (HL)
  case 0x035: t1=this.hl(); this.w1(t1,this.dec1(this.r1(t1))); this.cycles += 10; break; // DEC (HL)
  case 0x036: this.w1(this.hl(),this.next1()); this.cycles += 10; break; // LD (HL),n
  case 0x037: this.f |= CARRY; this.cycles += 4; break; // SCF
  case 0x038: t1=this.r1s(); t2=11; if (this.cf()) { this.pc=(this.pc+t1)&0xFFFF; t2=16; } this.cycles+=t2; break; // z80 JR C,d
  case 0x039: this.HL(this.add2(this.hl(),this.sp)); this.cycles += 11; break; // ADD HL,SP
  case 0x03A: this.a=this.r1(this.next2()); this.cycles += 13; break; // LD A,(nn)
  case 0x03B: this.sp=(this.sp-1)&0xFFFF; this.cycles += 6; break; // DEC SP
  case 0x03C: this.a=this.inc1(this.a); this.cycles += 5; break; // INC A
  case 0x03D: this.a=this.dec1(this.a); this.cycles += 5; break; // DEC A
  case 0x03E: this.a=this.next1(); this.cycles += 7; break; // LD A,n
  case 0x03F: this.f ^= CARRY; this.cycles += 4; break; // CCF

  case 0x040: this.b=this.b; this.cycles += 5; break; // LD B,B
  case 0x041: this.b=this.c; this.cycles += 5; break; // LD B,C
  case 0x042: this.b=this.d; this.cycles += 5; break; // LD B,D
  case 0x043: this.b=this.e; this.cycles += 5; break; // LD B,E
  case 0x044: this.b=this.h; this.cycles += 5; break; // LD B,H
  case 0x045: this.b=this.l; this.cycles += 5; break; // LD B,L
  case 0x046: this.b=this.r1(this.hl()); this.cycles += 7; break; // LD B,(HL)
  case 0x047: this.b=this.a; this.cycles += 5; break; // LD B,A
  case 0x048: this.c = this.b; this.cycles += 5; break; // LD C,B
  case 0x049: this.c = this.c; this.cycles += 5; break; // LD C,C
  case 0x04A: this.c = this.d; this.cycles += 5; break; // LD C,D
  case 0x04B: this.c = this.e; this.cycles += 5; break; // LD C,E
  case 0x04C: this.c = this.h; this.cycles += 5; break; // LD C,H
  case 0x04D: this.c = this.l; this.cycles += 5; break; // LD C,L
  case 0x04E: this.c = this.r1(this.hl()); this.cycles += 7; break; // LD C,(HL)
  case 0x04F: this.c = this.a; this.cycles += 5; break; // LD C,A

  case 0x050: this.d = this.b; this.cycles += 5; break; // LD D,B
  case 0x051: this.d = this.c; this.cycles += 5; break; // LD D,C
  case 0x052: this.d = this.d; this.cycles += 5; break; // LD D,D
  case 0x053: this.d = this.e; this.cycles += 5; break; // LD D,E
  case 0x054: this.d = this.h; this.cycles += 5; break; // LD D,H
  case 0x055: this.d = this.l; this.cycles += 5; break; // LD D,L
  case 0x056: this.d = this.r1(this.hl()); this.cycles += 7; break; // LD D,(HL)
  case 0x057: this.d = this.a; this.cycles += 5; break; // LD D,A
  case 0x058: this.e = this.b; this.cycles += 5; break; // LD E,B
  case 0x059: this.e = this.c; this.cycles += 5; break; // LD E,C
  case 0x05A: this.e = this.d; this.cycles += 5; break; // LD E,D
  case 0x05B: this.e = this.e; this.cycles += 5; break; // LD E,E
  case 0x05C: this.e = this.h; this.cycles += 5; break; // LD E,H
  case 0x05D: this.e = this.l; this.cycles += 5; break; // LD E,L
  case 0x05E: this.e = this.r1(this.hl()); this.cycles += 7; break; // LD E,(HL)
  case 0x05F: this.e = this.a; this.cycles += 5; break; // LD E,A

  case 0x060: this.h = this.b; this.cycles += 5; break; // LD H,B
  case 0x061: this.h = this.c; this.cycles += 5; break; // LD H,C
  case 0x062: this.h = this.d; this.cycles += 5; break; // LD H,D
  case 0x063: this.h = this.e; this.cycles += 5; break; // LD H,E
  case 0x064: this.h = this.h; this.cycles += 5; break; // LD H,H
  case 0x065: this.h = this.l; this.cycles += 5; break; // LD H,L
  case 0x066: this.h = this.r1(this.hl()); this.cycles += 7; break; // LD H,(HL)
  case 0x067: this.h = this.a; this.cycles += 5; break; // LD H,A
  case 0x068: this.l = this.b; this.cycles += 5; break; // LD L,B
  case 0x069: this.l = this.c; this.cycles += 5; break; // LD L,C
  case 0x06A: this.l = this.d; this.cycles += 5; break; // LD L,D
  case 0x06B: this.l = this.e; this.cycles += 5; break; // LD L,E
  case 0x06C: this.l = this.h; this.cycles += 5; break; // LD L,H
  case 0x06D: this.l = this.l; this.cycles += 5; break; // LD L,L
  case 0x06E: this.l = this.r1(this.hl()); this.cycles += 7; break; // LD L,(HL)
  case 0x06F: this.l = this.a; this.cycles += 5; break; // LD L,A

  case 0x070: this.w1(this.hl(), this.b); this.cycles += 7; break; // LD (HL),B
  case 0x071: this.w1(this.hl(), this.c); this.cycles += 7; break; // LD (HL),C
  case 0x072: this.w1(this.hl(), this.d); this.cycles += 7; break; // LD (HL),D
  case 0x073: this.w1(this.hl(), this.e); this.cycles += 7; break; // LD (HL),E
  case 0x074: this.w1(this.hl(), this.h); this.cycles += 7; break; // LD (HL),H
  case 0x075: this.w1(this.hl(), this.l); this.cycles += 7; break; // LD (HL),L
  case 0x076: this.cycles += 7; this.prefix=0; return false; // stop emulation HALT
  case 0x077: this.w1(this.hl(), this.a); this.cycles += 7; break; // LD (HL),A
  case 0x078: this.a = this.b; this.cycles += 5; break; // LD A,B
  case 0x079: this.a = this.c; this.cycles += 5; break; // LD A,C
  case 0x07A: this.a = this.d; this.cycles += 5; break; // LD A,D
  case 0x07B: this.a = this.e; this.cycles += 5; break; // LD A,E
  case 0x07C: this.a = this.h; this.cycles += 5; break; // LD A,H
  case 0x07D: this.a = this.l; this.cycles += 5; break; // LD A,L
  case 0x07E: this.a = this.r1(this.hl()); this.cycles += 7; break; // LD A,(HL)
  case 0x07F: this.a = this.a; this.cycles += 5; break; // LD A,A

  case 0x080: this.a = this.addByte(this.a, this.b); this.cycles += 4; break; // ADD A,B
  case 0x081: this.a = this.addByte(this.a, this.c); this.cycles += 4; break; // ADD A,C
  case 0x082: this.a = this.addByte(this.a, this.d); this.cycles += 4; break; // ADD A,D
  case 0x083: this.a = this.addByte(this.a, this.e); this.cycles += 4; break; // ADD A,E
  case 0x084: this.a = this.addByte(this.a, this.h); this.cycles += 4; break; // ADD A,H
  case 0x085: this.a = this.addByte(this.a, this.l); this.cycles += 4; break; // ADD A,L
  case 0x086: this.a = this.addByte(this.a, this.r1(this.hl())); this.cycles += 7; break; // ADD A,(HL)
  case 0x087: this.a = this.addByte(this.a, this.a); this.cycles += 4; break; // ADD A,A
  case 0x088: this.a = this.adc1(this.a, this.b); this.cycles += 4; break; // ADC A,B
  case 0x089: this.a = this.adc1(this.a, this.c); this.cycles += 4; break; // ADC A,C
  case 0x08A: this.a = this.adc1(this.a, this.d); this.cycles += 4; break; // ADC A,D
  case 0x08B: this.a = this.adc1(this.a, this.e); this.cycles += 4; break; // ADC A,E
  case 0x08C: this.a = this.adc1(this.a, this.h); this.cycles += 4; break; // ADC A,H
  case 0x08D: this.a = this.adc1(this.a, this.l); this.cycles += 4; break; // ADC A,L
  case 0x08E: this.a = this.adc1(this.a, this.r1(this.hl())); this.cycles += 7; break; // ADC A,(HL)
  case 0x08F: this.a = this.adc1(this.a, this.a); this.cycles += 4; break; // ADC A,A

  case 0x090: this.a = this.sub1(this.a, this.b); this.cycles += 4; break; // SUB B
  case 0x091: this.a = this.sub1(this.a, this.c); this.cycles += 4; break; // SUB C
  case 0x092: this.a = this.sub1(this.a, this.d); this.cycles += 4; break; // SUB D
  case 0x093: this.a = this.sub1(this.a, this.e); this.cycles += 4; break; // SUB E
  case 0x094: this.a = this.sub1(this.a, this.h); this.cycles += 4; break; // SUB H
  case 0x095: this.a = this.sub1(this.a, this.l); this.cycles += 4; break; // SUB L
  case 0x096: this.a = this.sub1(this.a, this.r1(this.hl())); this.cycles += 7; break; // SUB (HL)
  case 0x097: this.a = this.sub1(this.a, this.a); this.cycles += 4; break; // SUB A
  case 0x098: this.a = this.sbc1(this.a, this.b); this.cycles += 4; break; // SBC A,B
  case 0x099: this.a = this.sbc1(this.a, this.c); this.cycles += 4; break; // SBC A,C
  case 0x09A: this.a = this.sbc1(this.a, this.d); this.cycles += 4; break; // SBC A,D
  case 0x09B: this.a = this.sbc1(this.a, this.e); this.cycles += 4; break; // SBC A,E
  case 0x09C: this.a = this.sbc1(this.a, this.h); this.cycles += 4; break; // SBC A,H
  case 0x09D: this.a = this.sbc1(this.a, this.l); this.cycles += 4; break; // SBC A,L
  case 0x09E: this.a = this.sbc1(this.a, this.r1(this.hl())); this.cycles += 7; break; // SBC A,(HL)
  case 0x09F: this.a = this.sbc1(this.a, this.a); this.cycles += 4; break; // SBC A,A

  case 0x0A0: this.a = this.andByte(this.a, this.b); this.cycles += 4; break; // AND B
  case 0x0A1: this.a = this.andByte(this.a, this.c); this.cycles += 4; break; // AND C
  case 0x0A2: this.a = this.andByte(this.a, this.d); this.cycles += 4; break; // AND D
  case 0x0A3: this.a = this.andByte(this.a, this.e); this.cycles += 4; break; // AND E
  case 0x0A4: this.a = this.andByte(this.a, this.h); this.cycles += 4; break; // AND H
  case 0x0A5: this.a = this.andByte(this.a, this.l); this.cycles += 4; break; // AND L
  case 0x0A6: this.a = this.andByte(this.a, this.r1(this.hl())); this.cycles += 7; break; // AND (HL)
  case 0x0A7: this.a = this.andByte(this.a, this.a); this.cycles += 4; break; // AND A
  case 0x0A8: this.a = this.xorByte(this.a, this.b); this.cycles += 4; break; // XOR B
  case 0x0A9: this.a = this.xorByte(this.a, this.c); this.cycles += 4; break; // XOR C
  case 0x0AA: this.a = this.xorByte(this.a, this.d); this.cycles += 4; break; // XOR D
  case 0x0AB: this.a = this.xorByte(this.a, this.e); this.cycles += 4; break; // XOR E
  case 0x0AC: this.a = this.xorByte(this.a, this.h); this.cycles += 4; break; // XOR H
  case 0x0AD: this.a = this.xorByte(this.a, this.l); this.cycles += 4; break; // XOR L
  case 0x0AE: this.a = this.xorByte(this.a, this.r1(this.hl())); this.cycles += 7; break; // XOR (HL)
  case 0x0AF: this.a = this.xorByte(this.a, this.a); this.cycles += 4; break; // XOR A

  case 0x0B0: this.a = this.orByte(this.a, this.b); this.cycles += 4; break; // OR B
  case 0x0B1: this.a = this.orByte(this.a, this.c); this.cycles += 4; break; // OR C
  case 0x0B2: this.a = this.orByte(this.a, this.d); this.cycles += 4; break; // OR D
  case 0x0B3: this.a = this.orByte(this.a, this.e); this.cycles += 4; break; // OR E
  case 0x0B4: this.a = this.orByte(this.a, this.h); this.cycles += 4; break; // OR H
  case 0x0B5: this.a = this.orByte(this.a, this.l); this.cycles += 4; break; // OR L
  case 0x0B6: this.a = this.orByte(this.a, this.r1(this.hl())); this.cycles += 7; break; // OR (HL)
  case 0x0B7: this.a = this.orByte(this.a, this.a); this.cycles += 4; break; // OR A
  case 0x0B8: this.sub1(this.a, this.b); this.cycles += 4; break; // CP B
  case 0x0B9: this.sub1(this.a, this.c); this.cycles += 4; break; // CP C
  case 0x0BA: this.sub1(this.a, this.d); this.cycles += 4; break; // CP D
  case 0x0BB: this.sub1(this.a, this.e); this.cycles += 4; break; // CP E
  case 0x0BC: this.sub1(this.a, this.h); this.cycles += 4; break; // CP H
  case 0x0BD: this.sub1(this.a, this.l); this.cycles += 4; break; // CP L
  case 0x0BE: this.sub1(this.a, this.r1(this.hl())); this.cycles += 7; break; // CP (HL)
  case 0x0BF: this.sub1(this.a, this.a); this.cycles += 4; break; // CP A

  case 0x0C0: t1=5; if (!this.zf()) { this.pc= this.pop(); t1=11; } this.cycles += t1; break; // RET NZ
  case 0x0C1: this.BC(this.pop()); this.cycles += 10; break; // POP BC
  case 0x0C2: t1=this.next2(); if (!this.zf()) this.pc=t1; this.cycles += 10; break; // JP NZ,nn
  case 0x0C3: this.pc = this.r2(this.pc); this.cycles += 10; break; // JP nn
  case 0x0C4: t1=this.next2(); t2=11; if (!this.zf()) {this.push(this.pc); this.pc=t1; t2=17; } this.cycles+=t2; break; // CALL NZ,nn
  case 0x0C5: this.push(this.bc()); this.cycles += 11; break; // PUSH BC
  case 0x0C6: this.a = this.addByte(this.a, this.next1()); this.cycles += 7; break; // ADD A,n
  case 0x0C7: this.push(this.pc); this.pc = 0; this.cycles += 11; break; // RST 0
  case 0x0C8: t1=5; if (this.zf()) { this.pc= this.pop(); t1=11; } this.cycles += t1; break; // RET Z
  case 0x0C9: this.pc = this.pop(); this.cycles += 10; break; // RET
  case 0x0CA: t1=this.next2(); if (this.zf()) this.pc=t1; this.cycles += 10; break; // JP Z,nn

  // 22Oct17. gss.
  case 0x0CB: next= 0x100; break;
  case 0x100: this.b= this.rlc1(this.b); this.cycles += 8; break; // RLC B
  case 0x101: this.c= this.rlc1(this.c); this.cycles += 8; break; // RLC C
  case 0x102: this.d= this.rlc1(this.d); this.cycles += 8; break; // RLC D
  case 0x103: this.e= this.rlc1(this.e); this.cycles += 8; break; // RLC E
  case 0x104: this.h= this.rlc1(this.h); this.cycles += 8; break; // RLC H
  case 0x105: this.l= this.rlc1(this.l); this.cycles += 8; break; // RLC L
  case 0x106: this.w1(this.hl(), this.rlc1(this.r1(this.hl()))); this.cycles +=15; break; // RLC (HL)
  case 0x107: this.a= this.rlc1(this.a); this.cycles += 8; break; // RLC A
  //
  case 0x108: this.b= this.rrc1(this.b); this.cycles += 8; break; // RRC B
  case 0x109: this.c= this.rrc1(this.c); this.cycles += 8; break; // RRC C
  case 0x10A: this.d= this.rrc1(this.d); this.cycles += 8; break; // RRC D
  case 0x10B: this.e= this.rrc1(this.e); this.cycles += 8; break; // RRC E
  case 0x10C: this.h= this.rrc1(this.h); this.cycles += 8; break; // RRC H
  case 0x10D: this.l= this.rrc1(this.l); this.cycles += 8; break; // RRC L
  case 0x10E: this.w1(this.hl(), this.rrc1(this.r1(this.hl()))); this.cycles +=15; break; // RRC (HL)
  case 0x10F: this.a= this.rrc1(this.a); this.cycles += 8; break; // RRC A
  //
  case 0x110: this.b=this.rl1(this.b); this.cycles += 8; break; // RL B
  case 0x111: this.c=this.rl1(this.c); this.cycles += 8; break; // RL C
  case 0x112: this.d=this.rl1(this.d); this.cycles += 8; break; // RL D
  case 0x113: this.e=this.rl1(this.e); this.cycles += 8; break; // RL E
  case 0x114: this.h=this.rl1(this.h); this.cycles += 8; break; // RL H
  case 0x115: this.l=this.rl1(this.l); this.cycles += 8; break; // RL L
  case 0x116: t1=this.hl(); this.w1(t1,this.rl1(this.r1(t1))); this.cycles+=15; break; // RL (HL)
  case 0x117: this.a=this.rl1(this.a); this.cycles += 8; break; // RL A
  //
  case 0x118: this.b=this.rr1(this.b); this.cycles += 8; break; // RR B
  case 0x119: this.c=this.rr1(this.c); this.cycles += 8; break; // RR C
  case 0x11A: this.d=this.rr1(this.d); this.cycles += 8; break; // RR D
  case 0x11B: this.e=this.rr1(this.e); this.cycles += 8; break; // RR E
  case 0x11C: this.h=this.rr1(this.h); this.cycles += 8; break; // RR H
  case 0x11D: this.l=this.rr1(this.l); this.cycles += 8; break; // RR L
  case 0x11E: t1=this.hl(); this.w1(t1,this.rr1(this.r1(t1))); this.cycles+=15; break; // RR (HL)
  case 0x11F: this.a=this.rr1(this.a); this.cycles += 8; break; // RR A

  case 0x120: this.b=this.sla1(this.b); this.cycles+=8; break; // SLA B
  case 0x121: this.c=this.sla1(this.c); this.cycles+=8; break; // SLA C
  case 0x122: this.d=this.sla1(this.d); this.cycles+=8; break; // SLA D
  case 0x123: this.e=this.sla1(this.e); this.cycles+=8; break; // SLA E
  case 0x124: this.h=this.sla1(this.h); this.cycles+=8; break; // SLA H
  case 0x125: this.l=this.sla1(this.l); this.cycles+=8; break; // SLA L
  case 0x126: t1=this.hl(); this.w1(t1,this.sla1(this.r1(t1))); this.cycles+=15; break; // SLA (HL)
  case 0x127: this.a=this.sla1(this.a); this.cycles+=8; break; // SLA A

  case 0x128: this.b=this.sra1(this.b); this.cycles+=8; break; // SRA B
  case 0x129: this.c=this.sra1(this.c); this.cycles+=8; break; // SRA C
  case 0x12A: this.d=this.sra1(this.d); this.cycles+=8; break; // SRA D
  case 0x12B: this.e=this.sra1(this.e); this.cycles+=8; break; // SRA E
  case 0x12C: this.h=this.sra1(this.h); this.cycles+=8; break; // SRA H
  case 0x12D: this.l=this.sra1(this.l); this.cycles+=8; break; // SRA L
  case 0x12E: t1=this.hl(); this.w1(t1,this.sra1(this.r1(t1))); this.cycles+=15; break; // SRA (HL)
  case 0x12F: this.a=this.sra1(this.a); this.cycles+=8; break; // SRA A

  case 0x130: this.b=this.sll1(this.b); this.cycles+=8; break; // SLL B (130-7 undoc)
  case 0x131: this.c=this.sll1(this.c); this.cycles+=8; break; // SLL C
  case 0x132: this.d=this.sll1(this.d); this.cycles+=8; break; // SLL D
  case 0x133: this.e=this.sll1(this.e); this.cycles+=8; break; // SLL E
  case 0x134: this.h=this.sll1(this.h); this.cycles+=8; break; // SLL H
  case 0x135: this.l=this.sll1(this.l); this.cycles+=8; break; // SLL L
  case 0x136: t1=this.hl(); this.w1(t1,this.sll1(this.r1(t1))); this.cycles+=15; break; // SLL (HL)
  case 0x137: this.a=this.sll1(this.a); this.cycles+=8; break; // SLL A

  case 0x138: this.b=this.srl1(this.b); this.cycles+=8; break; // SRL B
  case 0x139: this.c=this.srl1(this.c); this.cycles+=8; break; // SRL C
  case 0x13A: this.d=this.srl1(this.d); this.cycles+=8; break; // SRL D
  case 0x13B: this.e=this.srl1(this.e); this.cycles+=8; break; // SRL E
  case 0x13C: this.h=this.srl1(this.h); this.cycles+=8; break; // SRL H
  case 0x13D: this.l=this.srl1(this.l); this.cycles+=8; break; // SRL L
  case 0x13E: t1=this.hl(); this.w1(t1,this.srl1(this.r1(t1))); this.cycles+=15; break; // SRL (HL)
  case 0x13F: this.a=this.srl1(this.a); this.cycles+=8; break; // SRL A

  case 0x140: this.bit1(this.b,1); this.cycles+=8; break; // BIT 0,B
  case 0x141: this.bit1(this.c,1); this.cycles+=8; break; // BIT 0,C
  case 0x142: this.bit1(this.d,1); this.cycles+=8; break; // BIT 0,D
  case 0x143: this.bit1(this.e,1); this.cycles+=8; break; // BIT 0,E
  case 0x144: this.bit1(this.h,1); this.cycles+=8; break; // BIT 0,H
  case 0x145: this.bit1(this.l,1); this.cycles+=8; break; // BIT 0,L
  case 0x146: this.bit1(this.r1(this.hl()),1); this.cycles+=12; break; // BIT 0,(HL)
  case 0x147: this.bit1(this.a,1); this.cycles+=8; break; // BIT 0,A

  case 0x148: this.bit1(this.b,2); this.cycles+=8; break; // BIT 1,B
  case 0x149: this.bit1(this.c,2); this.cycles+=8; break; // BIT 1,C
  case 0x14A: this.bit1(this.d,2); this.cycles+=8; break; // BIT 1,D
  case 0x14B: this.bit1(this.e,2); this.cycles+=8; break; // BIT 1,E
  case 0x14C: this.bit1(this.h,2); this.cycles+=8; break; // BIT 1,H
  case 0x14D: this.bit1(this.l,2); this.cycles+=8; break; // BIT 1,L
  case 0x14E: this.bit1(this.r1(this.hl()),2); this.cycles+=12; break; // BIT 1,(HL)
  case 0x14F: this.bit1(this.a,2); this.cycles+=8; break; // BIT 1,A

  case 0x150: this.bit1(this.b,4); this.cycles+=8; break; // BIT 2,B
  case 0x151: this.bit1(this.c,4); this.cycles+=8; break; // BIT 2,C
  case 0x152: this.bit1(this.d,4); this.cycles+=8; break; // BIT 2,D
  case 0x153: this.bit1(this.e,4); this.cycles+=8; break; // BIT 2,E
  case 0x154: this.bit1(this.h,4); this.cycles+=8; break; // BIT 2,H
  case 0x155: this.bit1(this.l,4); this.cycles+=8; break; // BIT 2,L
  case 0x156: this.bit1(this.r1(this.hl()),4); this.cycles+=12; break; // BIT 2,(HL)
  case 0x157: this.bit1(this.a,4); this.cycles+=8; break; // BIT 2,A

  case 0x158: this.bit1(this.b,8); this.cycles+=8; break; // BIT 3,B
  case 0x159: this.bit1(this.c,8); this.cycles+=8; break; // BIT 3,C
  case 0x15A: this.bit1(this.d,8); this.cycles+=8; break; // BIT 3,D
  case 0x15B: this.bit1(this.e,8); this.cycles+=8; break; // BIT 3,E
  case 0x15C: this.bit1(this.h,8); this.cycles+=8; break; // BIT 3,H
  case 0x15D: this.bit1(this.l,8); this.cycles+=8; break; // BIT 3,L
  case 0x15E: this.bit1(this.r1(this.hl()),8); this.cycles+=12; break; // BIT 3,(HL)
  case 0x15F: this.bit1(this.a,8); this.cycles+=8; break; // BIT 3,A

  case 0x160: this.bit1(this.b,16); this.cycles+=8; break; // BIT 4,B
  case 0x161: this.bit1(this.c,16); this.cycles+=8; break; // BIT 4,C
  case 0x162: this.bit1(this.d,16); this.cycles+=8; break; // BIT 4,D
  case 0x163: this.bit1(this.e,16); this.cycles+=8; break; // BIT 4,E
  case 0x164: this.bit1(this.h,16); this.cycles+=8; break; // BIT 4,H
  case 0x165: this.bit1(this.l,16); this.cycles+=8; break; // BIT 4,L
  case 0x166: this.bit1(this.r1(this.hl()),16); this.cycles+=12; break; // BIT 4,(HL)
  case 0x167: this.bit1(this.a,16); this.cycles+=8; break; // BIT 4,A

  case 0x168: this.bit1(this.b,32); this.cycles+=8; break; // BIT 5,B
  case 0x169: this.bit1(this.c,32); this.cycles+=8; break; // BIT 5,C
  case 0x16A: this.bit1(this.d,32); this.cycles+=8; break; // BIT 5,D
  case 0x16B: this.bit1(this.e,32); this.cycles+=8; break; // BIT 5,E
  case 0x16C: this.bit1(this.h,32); this.cycles+=8; break; // BIT 5,H
  case 0x16D: this.bit1(this.l,32); this.cycles+=8; break; // BIT 5,L
  case 0x16E: this.bit1(this.r1(this.hl()),32); this.cycles+=12; break; // BIT 5,(HL)
  case 0x16F: this.bit1(this.a,32); this.cycles+=8; break; // BIT 5,A

  case 0x170: this.bit1(this.b,64); this.cycles+=8; break; // BIT 6,B
  case 0x171: this.bit1(this.c,64); this.cycles+=8; break; // BIT 6,C
  case 0x172: this.bit1(this.d,64); this.cycles+=8; break; // BIT 6,D
  case 0x173: this.bit1(this.e,64); this.cycles+=8; break; // BIT 6,E
  case 0x174: this.bit1(this.h,64); this.cycles+=8; break; // BIT 6,H
  case 0x175: this.bit1(this.l,64); this.cycles+=8; break; // BIT 6,L
  case 0x176: this.bit1(this.r1(this.hl()),64); this.cycles+=12; break; // BIT 6,(HL)
  case 0x177: this.bit1(this.a,64); this.cycles+=8; break; // BIT 6,A

  case 0x178: this.bit1(this.b,128); this.cycles+=8; break; // BIT 7,B
  case 0x179: this.bit1(this.c,128); this.cycles+=8; break; // BIT 7,C
  case 0x17A: this.bit1(this.d,128); this.cycles+=8; break; // BIT 7,D
  case 0x17B: this.bit1(this.e,128); this.cycles+=8; break; // BIT 7,E
  case 0x17C: this.bit1(this.h,128); this.cycles+=8; break; // BIT 7,H
  case 0x17D: this.bit1(this.l,128); this.cycles+=8; break; // BIT 7,L
  case 0x17E: this.bit1(this.r1(this.hl()),128); this.cycles+=12; break; // BIT 7,(HL)
  case 0x17F: this.bit1(this.a,128); this.cycles+=8; break; // BIT 7,A

  case 0x180: this.b &= ~0x01; this.cycles+=8; break; // RES 0,B
  case 0x181: this.c &= ~0x01; this.cycles+=8; break; // RES 0,C
  case 0x182: this.d &= ~0x01; this.cycles+=8; break; // RES 0,D
  case 0x183: this.e &= ~0x01; this.cycles+=8; break; // RES 0,E
  case 0x184: this.h &= ~0x01; this.cycles+=8; break; // RES 0,H
  case 0x185: this.l &= ~0x01; this.cycles+=8; break; // RES 0,L
  case 0x186: t1=this.hl(); t2=this.r1(t1); t2 &= ~0x01; this.w1(t1,t2); this.cycles+=15; break; // RES 0,(HL)
  case 0x187: this.a &= ~0x01; this.cycles+=8; break; // RES 0,A
  case 0x188: this.b &= ~0x02; this.cycles+=8; break; // RES 1,B
  case 0x189: this.c &= ~0x02; this.cycles+=8; break; // RES 1,C
  case 0x18A: this.d &= ~0x02; this.cycles+=8; break; // RES 1,D
  case 0x18B: this.e &= ~0x02; this.cycles+=8; break; // RES 1,E
  case 0x18C: this.h &= ~0x02; this.cycles+=8; break; // RES 1,H
  case 0x18D: this.l &= ~0x02; this.cycles+=8; break; // RES 1,L
  case 0x18E: t1=this.hl(); t2=this.r1(t1); t2 &= ~0x02; this.w1(t1,t2); this.cycles+=15; break; // RES 1,(HL)
  case 0x18F: this.a &= ~0x02; this.cycles+=8; break; // RES 1,A
  case 0x190: this.b &= ~0x04; this.cycles+=8; break; // RES 2,B
  case 0x191: this.c &= ~0x04; this.cycles+=8; break; // RES 2,C
  case 0x192: this.d &= ~0x04; this.cycles+=8; break; // RES 2,D
  case 0x193: this.e &= ~0x04; this.cycles+=8; break; // RES 2,E
  case 0x194: this.h &= ~0x04; this.cycles+=8; break; // RES 2,H
  case 0x195: this.l &= ~0x04; this.cycles+=8; break; // RES 2,L
  case 0x196: t1=this.hl(); t2=this.r1(t1); t2 &= ~0x04; this.w1(t1,t2); this.cycles+=15; break; // RES 2,(HL)
  case 0x197: this.a &= ~0x04; this.cycles+=8; break; // RES 2,A
  case 0x198: this.b &= ~0x08; this.cycles+=8; break; // RES 3,B
  case 0x199: this.c &= ~0x08; this.cycles+=8; break; // RES 3,C
  case 0x19A: this.d &= ~0x08; this.cycles+=8; break; // RES 3,D
  case 0x19B: this.e &= ~0x08; this.cycles+=8; break; // RES 3,E
  case 0x19C: this.h &= ~0x08; this.cycles+=8; break; // RES 3,H
  case 0x19D: this.l &= ~0x08; this.cycles+=8; break; // RES 3,L
  case 0x19E: t1=this.hl(); t2=this.r1(t1); t2 &= ~0x08; this.w1(t1,t2); this.cycles+=15; break; // RES 3,(HL)
  case 0x19F: this.a &= ~0x08; this.cycles+=8; break; // RES 3,A
  case 0x1A0: this.b &= ~0x10; this.cycles+=8; break; // RES 4,B
  case 0x1A1: this.c &= ~0x10; this.cycles+=8; break; // RES 4,C
  case 0x1A2: this.d &= ~0x10; this.cycles+=8; break; // RES 4,D
  case 0x1A3: this.e &= ~0x10; this.cycles+=8; break; // RES 4,E
  case 0x1A4: this.h &= ~0x10; this.cycles+=8; break; // RES 4,H
  case 0x1A5: this.l &= ~0x10; this.cycles+=8; break; // RES 4,L
  case 0x1A6: t1=this.hl(); t2=this.r1(t1); t2 &= ~0x10; this.w1(t1,t2); this.cycles+=15; break; // RES 4,(HL)
  case 0x1A7: this.a &= ~0x10; this.cycles+=8; break; // RES 4,A
  case 0x1A8: this.b &= ~0x20; this.cycles+=8; break; // RES 5,B
  case 0x1A9: this.c &= ~0x20; this.cycles+=8; break; // RES 5,C
  case 0x1AA: this.d &= ~0x20; this.cycles+=8; break; // RES 5,D
  case 0x1AB: this.e &= ~0x20; this.cycles+=8; break; // RES 5,E
  case 0x1AC: this.h &= ~0x20; this.cycles+=8; break; // RES 5,H
  case 0x1AD: this.l &= ~0x20; this.cycles+=8; break; // RES 5,L
  case 0x1AE: t1=this.hl(); t2=this.r1(t1); t2 &= ~0x20; this.w1(t1,t2); this.cycles+=15; break; // RES 5,(HL)
  case 0x1AF: this.a &= ~0x20; this.cycles+=8; break; // RES 5,A
  case 0x1B0: this.b &= ~0x40; this.cycles+=8; break; // RES 6,B
  case 0x1B1: this.c &= ~0x40; this.cycles+=8; break; // RES 6,C
  case 0x1B2: this.d &= ~0x40; this.cycles+=8; break; // RES 6,D
  case 0x1B3: this.e &= ~0x40; this.cycles+=8; break; // RES 6,E
  case 0x1B4: this.h &= ~0x40; this.cycles+=8; break; // RES 6,H
  case 0x1B5: this.l &= ~0x40; this.cycles+=8; break; // RES 6,L
  case 0x1B6: t1=this.hl(); t2=this.r1(t1); t2 &= ~0x40; this.w1(t1,t2); this.cycles+=15; break; // RES 6,(HL)
  case 0x1B7: this.a &= ~0x40; this.cycles+=8; break; // RES 6,A
  case 0x1B8: this.b &= ~0x80; this.cycles+=8; break; // RES 7,B
  case 0x1B9: this.c &= ~0x80; this.cycles+=8; break; // RES 7,C
  case 0x1BA: this.d &= ~0x80; this.cycles+=8; break; // RES 7,D
  case 0x1BB: this.e &= ~0x80; this.cycles+=8; break; // RES 7,E
  case 0x1BC: this.h &= ~0x80; this.cycles+=8; break; // RES 7,H
  case 0x1BD: this.l &= ~0x80; this.cycles+=8; break; // RES 7,L
  case 0x1BE: t1=this.hl(); t2=this.r1(t1); t2 &= ~0x80; this.w1(t1,t2); this.cycles+=15; break; // RES 7,(HL)
  case 0x1BF: this.a &= ~0x80; this.cycles+=8; break; // RES 7,A
  case 0x1C0: this.b |= 0x01; this.cycles+=8; break; // SET 0,B
  case 0x1C1: this.c |= 0x01; this.cycles+=8; break; // SET 0,C
  case 0x1C2: this.d |= 0x01; this.cycles+=8; break; // SET 0,D
  case 0x1C3: this.e |= 0x01; this.cycles+=8; break; // SET 0,E
  case 0x1C4: this.h |= 0x01; this.cycles+=8; break; // SET 0,H
  case 0x1C5: this.l |= 0x01; this.cycles+=8; break; // SET 0,L
  case 0x1C6: t1=this.hl(); t2=this.r1(t1); t2 |= 0x01; this.w1(t1,t2); this.cycles+=15; break; // SET 0,(HL)
  case 0x1C7: this.a |= 0x01; this.cycles+=8; break; // SET 0,A
  case 0x1C8: this.b |= 0x02; this.cycles+=8; break; // SET 1,B
  case 0x1C9: this.c |= 0x02; this.cycles+=8; break; // SET 1,C
  case 0x1CA: this.d |= 0x02; this.cycles+=8; break; // SET 1,D
  case 0x1CB: this.e |= 0x02; this.cycles+=8; break; // SET 1,E
  case 0x1CC: this.h |= 0x02; this.cycles+=8; break; // SET 1,H
  case 0x1CD: this.l |= 0x02; this.cycles+=8; break; // SET 1,L
  case 0x1CE: t1=this.hl(); t2=this.r1(t1); t2 |= 0x02; this.w1(t1,t2); this.cycles+=15; break; // SET 1,(HL)
  case 0x1CF: this.a |= 0x02; this.cycles+=8; break; // SET 1,A
  case 0x1D0: this.b |= 0x04; this.cycles+=8; break; // SET 2,B
  case 0x1D1: this.c |= 0x04; this.cycles+=8; break; // SET 2,C
  case 0x1D2: this.d |= 0x04; this.cycles+=8; break; // SET 2,D
  case 0x1D3: this.e |= 0x04; this.cycles+=8; break; // SET 2,E
  case 0x1D4: this.h |= 0x04; this.cycles+=8; break; // SET 2,H
  case 0x1D5: this.l |= 0x04; this.cycles+=8; break; // SET 2,L
  case 0x1D6: t1=this.hl(); t2=this.r1(t1); t2 |= 0x04; this.w1(t1,t2); this.cycles+=15; break; // SET 2,(HL)
  case 0x1D7: this.a |= 0x04; this.cycles+=8; break; // SET 2,A
  case 0x1D8: this.b |= 0x08; this.cycles+=8; break; // SET 3,B
  case 0x1D9: this.c |= 0x08; this.cycles+=8; break; // SET 3,C
  case 0x1DA: this.d |= 0x08; this.cycles+=8; break; // SET 3,D
  case 0x1DB: this.e |= 0x08; this.cycles+=8; break; // SET 3,E
  case 0x1DC: this.h |= 0x08; this.cycles+=8; break; // SET 3,H
  case 0x1DD: this.l |= 0x08; this.cycles+=8; break; // SET 3,L
  case 0x1DE: t1=this.hl(); t2=this.r1(t1); t2 |= 0x08; this.w1(t1,t2); this.cycles+=15; break; // SET 3,(HL)
  case 0x1DF: this.a |= 0x08; this.cycles+=8; break; // SET 3,A
  case 0x1E0: this.b |= 0x10; this.cycles+=8; break; // SET 4,B
  case 0x1E1: this.c |= 0x10; this.cycles+=8; break; // SET 4,C
  case 0x1E2: this.d |= 0x10; this.cycles+=8; break; // SET 4,D
  case 0x1E3: this.e |= 0x10; this.cycles+=8; break; // SET 4,E
  case 0x1E4: this.h |= 0x10; this.cycles+=8; break; // SET 4,H
  case 0x1E5: this.l |= 0x10; this.cycles+=8; break; // SET 4,L
  case 0x1E6: t1=this.hl(); t2=this.r1(t1); t2 |= 0x10; this.w1(t1,t2); this.cycles+=15; break; // SET 4,(HL)
  case 0x1E7: this.a |= 0x10; this.cycles+=8; break; // SET 4,A
  case 0x1E8: this.b |= 0x20; this.cycles+=8; break; // SET 5,B
  case 0x1E9: this.c |= 0x20; this.cycles+=8; break; // SET 5,C
  case 0x1EA: this.d |= 0x20; this.cycles+=8; break; // SET 5,D
  case 0x1EB: this.e |= 0x20; this.cycles+=8; break; // SET 5,E
  case 0x1EC: this.h |= 0x20; this.cycles+=8; break; // SET 5,H
  case 0x1ED: this.l |= 0x20; this.cycles+=8; break; // SET 5,L
  case 0x1EE: t1=this.hl(); t2=this.r1(t1); t2 |= 0x20; this.w1(t1,t2); this.cycles+=15; break; // SET 5,(HL)
  case 0x1EF: this.a |= 0x20; this.cycles+=8; break; // SET 5,A
  case 0x1F0: this.b |= 0x40; this.cycles+=8; break; // SET 6,B
  case 0x1F1: this.c |= 0x40; this.cycles+=8; break; // SET 6,C
  case 0x1F2: this.d |= 0x40; this.cycles+=8; break; // SET 6,D
  case 0x1F3: this.e |= 0x40; this.cycles+=8; break; // SET 6,E
  case 0x1F4: this.h |= 0x40; this.cycles+=8; break; // SET 6,H
  case 0x1F5: this.l |= 0x40; this.cycles+=8; break; // SET 6,L
  case 0x1F6: t1=this.hl(); t2=this.r1(t1); t2 |= 0x40; this.w1(t1,t2); this.cycles+=15; break; // SET 6,(HL)
  case 0x1F7: this.a |= 0x40; this.cycles+=8; break; // SET 6,A
  case 0x1F8: this.b |= 0x80; this.cycles+=8; break; // SET 7,B
  case 0x1F9: this.c |= 0x80; this.cycles+=8; break; // SET 7,C
  case 0x1FA: this.d |= 0x80; this.cycles+=8; break; // SET 7,D
  case 0x1FB: this.e |= 0x80; this.cycles+=8; break; // SET 7,E
  case 0x1FC: this.h |= 0x80; this.cycles+=8; break; // SET 7,H
  case 0x1FD: this.l |= 0x80; this.cycles+=8; break; // SET 7,L
  case 0x1FE: t1=this.hl(); t2=this.r1(t1); t2 |= 0x80; this.w1(t1,t2); this.cycles+=15; break; // SET 7,(HL)
  case 0x1FF: this.a |= 0x80; this.cycles+=8; break; // SET 7,A

  case 0x0CC: t1= this.next2(); t2=11;
              if (this.f&ZF) { t2=17; this.push(this.pc); this.pc=t1; }
              this.cycles += t2; 
              break; // CALL Z,nn
  case 0x0CD: t1= this.next2(); this.push(this.pc); this.pc=t1; this.cycles+=17; break; // CALL nn
  case 0x0CE: this.a = this.adc1(this.a,this.next1()); this.cycles+=7; break; // ADC A,n
  case 0x0CF: this.push(this.pc); this.pc = 0x08; this.cycles += 11; break; // RST 8

  case 0x0D0: t1=5; if (!this.cf()) {this.pc=this.pop(); t1=11} this.cycles+=t1; break; // RET NC
  case 0x0D1: this.DE(this.pop()); this.cycles += 10; break; // POP DE
  case 0x0D2: t1=this.next2(); if(!this.cf()) { this.pc=t1; } this.cycles+=10; break; // JP NC,nn
  case 0x0D3: this.writePort(this.next1(),this.a); this.cycles+=10; break; // OUT (n),A
  case 0x0D4: t1=this.next2(); t2=11; if (!this.cf()) {t2=17; this.push(this.pc); this.pc=t1;} this.cycles+=t2; break; // CALL NC,nn
  case 0x0D5: this.push(this.de()); this.cycles += 11; break; // PUSH DE
  case 0x0D6: this.a = this.sub1(this.a,this.next1()); this.cycles+=7; break; // SUB n
  case 0x0D7: this.push(this.pc); this.pc=0x10; this.cycles+=11; break; // RST 10H
  case 0x0D8: t1=5; if (this.cf()) { this.pc=this.pop(); t1=11;} this.cycles+=t1; break; // RET C

  // 22Oct17. gss.
  case 0x0D9: t1=this.b; this.b= this.b_; this.b_=t1; // EXX
              t1=this.c; this.c= this.c_; this.c_=t1;
              t1=this.d; this.d= this.d_; this.d_=t1;
              t1=this.e; this.e= this.e_; this.e_=t1;
              t1=this.h; this.h= this.h_; this.h_=t1;
              t1=this.l; this.l= this.l_; this.l_=t1;
              this.cycles += 4; break;
  
  case 0x0DA: t1=this.next2(); if (this.cf()) {this.pc=t1;} this.cycles+=10; break; // JP C,nn
  case 0x0DB: this.a = this.readPort(this.next1()); this.cycles += 10; break; // IN A,(n)
  case 0x0DC: t1=this.next2(); t2=11; if (this.cf()) {this.push(this.pc); this.pc=t1; t2=17;} this.cycles+=t2; break; // CALL C,nn

  // 22Oct17. gss.
  case 0x0DD: next= 0x300; break;
  case 0x309: this.IX(this.add2(this.ix(),this.bc())); this.cycles+=15; break; // ADD IX,BC
  case 0x319: this.IX(this.add2(this.ix(),this.de())); this.cycles+=15; break; // ADD IX,DE
  case 0x321: this.IX(this.next2()); this.cycles += 14; break; // LD IX,nn
  case 0x322: this.w2(this.next2(), this.ix()); this.cycles += 20; break; // LD (nn),IX
  case 0x323: this.IX((this.ix()+1)&0xFFFF); this.cycles+=10; break; // INC IX
  case 0x329: this.IX(this.add2(this.ix(),this.ix())); this.cycles+=15; break; // ADD IX,IX
  case 0x32A: t1=this.next2(); this.IX(this.r2(t1)); this.cycles+=20; break; // LD IX,(nn)
  case 0x32B: this.IX((this.ix()-1)&0xFFFF);  this.cycles+=10; break; // DEC IX
  case 0x334: t1=this._ixd(); this.w1(t1,this.inc1(this.r1(t1))); this.cycles+=23; break; // INC (IX+d)
  case 0x335: t1=this._ixd(); this.w1(t1,this.dec1(this.r1(t1))); this.cycles+=23; break; // DEC (IX+d)
  case 0x336: t1=this._ixd(); t2=this.next1(); this.w1(t1,t2); this.cycles+=19; break; // LD (IX+d),n
  case 0x339: this.IX(this.add2(this.ix(),this.sp())); this.cycles+=15; break; // ADD IX,SP
  case 0x346: t1=this._ixd(); this.b= this.r1(t1); this.cycles+=19; break; // LD B,(IX+d)
  case 0x34E: t1=this._ixd(); this.c= this.r1(t1); this.cycles+=19; break; // LD C,(IX+d)
  case 0x356: t1=this._ixd(); this.d= this.r1(t1); this.cycles+=19; break; // LD D,(IX+d)
  case 0x35E: t1=this._ixd(); this.e= this.r1(t1); this.cycles+=19; break; // LD E,(IX+d)
  case 0x366: t1=this._ixd(); this.h= this.r1(t1); this.cycles+=19; break; // LD H,(IX+d)
  case 0x36E: t1=this._ixd(); this.l= this.r1(t1); this.cycles+=19; break; // LD L,(IX+d)
  case 0x370: t1=this._ixd(); this.w1(t1,this.b); this.cycles+=19; break; // LD (IX+d),B
  case 0x371: t1=this._ixd(); this.w1(t1,this.c); this.cycles+=19; break; // LD (IX+d),C
  case 0x372: t1=this._ixd(); this.w1(t1,this.d); this.cycles+=19; break; // LD (IX+d),D
  case 0x373: t1=this._ixd(); this.w1(t1,this.e); this.cycles+=19; break; // LD (IX+d),E
  case 0x374: t1=this._ixd(); this.w1(t1,this.h); this.cycles+=19; break; // LD (IX+d),H
  case 0x375: t1=this._ixd(); this.w1(t1,this.l); this.cycles+=19; break; // LD (IX+d),L
  case 0x377: t1=this._ixd(); this.w1(t1,this.a); this.cycles+=19; break; // LD (IX+d),A
  case 0x37E: t1=this._ixd(); this.a= this.r1(t1); this.cycles+=19; break; // LD A,(IX+d)
  case 0x386: t1=this._ixd(); this.a= this.add1(this.a,this.r1(t1)); this.cycles+=19; break; // ADD (IX+d)
  case 0x38E: t1=this._ixd(); this.a= this.adc1(this.a,this.r1(t1)); this.cycles+=19; break; // ADC A,(IX+d); TODO or z80 adc8(b)
  case 0x396: t1=this._ixd(); this.a= this.sub1(this.a,this.r1(t1)); this.cycles+=19; break; // SUB (IX+d)
  case 0x39E: t1=this._ixd(); this.a= this.sbc1(this.a,this.r1(t1)); this.cycles+=19; break; // SBC A,(IX+d)
  case 0x3A6: t1=this._ixd(); this.a= this.andByte(this.a,this.r1(t1)); this.cycles+=19; break; // AND A,(IX+d)
  case 0x3AE: t1=this._ixd(); this.a= this.xorByte(this.a,this.r1(t1)); this.cycles+=19; break; // XOR A,(IX+d)
  case 0x3B6: t1=this._ixd(); this.a= this.orByte(this.a,this.r1(t1)); this.cycles+=19; break; // OR (IX+d)
  case 0x3BE: this.sub1(this.a, this.r1((this.ix()+this.next1s())&0xFFFF)); this.cycles+=19; break; // CP (IX+d)
  case 0x3CB: next= 0x500; this.wz= this._ixd(); break; // DD CB dd op; wz data pointer = IX+dd
  case 0x3E1: this.IX(this.pop()); this.cycles += 14; break; // POP IX
  case 0x3E3: t1=this.r2(this.sp); this.w2(this.sp,this.ix()); this.IX(t1); this.cycles+=23; break; // EX (SP),IX
  case 0x3E5: this.push(this.ix()); this.cycles += 15; break; // PUSH IX
  case 0x3E9: this.pc=this.ix(); this.cycles+= 8; break; // JP IX
  case 0x3F9: this.sp=this.ix(); this.cycles+=10; break; // LD SP,IX
  case 0x3FD: next= 0x400; break; // undoc

  // used for IX+d and IY+d
  case 0x506: t1=this.wz; this.w1(t1,this.rlc1(this.r1(t1))); this.cycles+=23; break; // RLC (IX+d)
  case 0x50E: t1=this.wz; this.w1(t1,this.rrc1(this.r1(t1))); this.cycles+=23; break; // RRC (IX+d)
  case 0x516: t1=this.wz; this.w1(t1,this.rl1( this.r1(t1))); this.cycles+=23; break; // RL (IX+d)
  case 0x51E: t1=this.wz; this.w1(t1,this.rr1( this.r1(t1))); this.cycles+=23; break; // RR (IX+d)
  case 0x526: t1=this.wz; this.w1(t1,this.sla1(this.r1(t1))); this.cycles+=23; break; // SLA (IX+d)
  case 0x52E: t1=this.wz; this.w1(t1,this.sra1(this.r1(t1))); this.cycles+=23; break; // SRA (IX+d)
  case 0x53E: t1=this.wz; this.w1(t1,this.srl1(this.r1(t1))); this.cycles+=23; break; // SRL (IX+d)
  case 0x546: t1=this.wz; this.bit1(this.r1(t1),  1); this.cycles+=20; break; // BIT 0,(IX+d)
  case 0x54E: t1=this.wz; this.bit1(this.r1(t1),  2); this.cycles+=20; break; // BIT 1,(IX+d)
  case 0x556: t1=this.wz; this.bit1(this.r1(t1),  4); this.cycles+=20; break; // BIT 2,(IX+d)
  case 0x55E: t1=this.wz; this.bit1(this.r1(t1),  8); this.cycles+=20; break; // BIT 3,(IX+d)
  case 0x566: t1=this.wz; this.bit1(this.r1(t1), 16); this.cycles+=20; break; // BIT 4,(IX+d)
  case 0x56E: t1=this.wz; this.bit1(this.r1(t1), 32); this.cycles+=20; break; // BIT 5,(IX+d)
  case 0x576: t1=this.wz; this.bit1(this.r1(t1), 64); this.cycles+=20; break; // BIT 6,(IX+d)
  case 0x57E: t1=this.wz; this.bit1(this.r1(t1),128); this.cycles+=20; break; // BIT 7,(IX+d)
  case 0x586: t1=this.wz; this.w1(t1,this.r1(t1) & ~0x01); this.cycles+=23; break; // RES 0,(IX+d)
  case 0x58E: t1=this.wz; this.w1(t1,this.r1(t1) & ~0x02); this.cycles+=23; break; // RES 1,(IX+d)
  case 0x596: t1=this.wz; this.w1(t1,this.r1(t1) & ~0x04); this.cycles+=23; break; // RES 2,(IX+d)
  case 0x59E: t1=this.wz; this.w1(t1,this.r1(t1) & ~0x08); this.cycles+=23; break; // RES 3,(IX+d)
  case 0x5A6: t1=this.wz; this.w1(t1,this.r1(t1) & ~0x10); this.cycles+=23; break; // RES 4,(IX+d)
  case 0x5AE: t1=this.wz; this.w1(t1,this.r1(t1) & ~0x20); this.cycles+=23; break; // RES 5,(IX+d)
  case 0x5B6: t1=this.wz; this.w1(t1,this.r1(t1) & ~0x40); this.cycles+=23; break; // RES 6,(IX+d)
  case 0x5BE: t1=this.wz; this.w1(t1,this.r1(t1) & ~0x80); this.cycles+=23; break; // RES 7,(IX+d)
  case 0x5C6: t1=this.wz; this.w1(t1,this.r1(t1) |  0x01); this.cycles+=23; break; // SET 0,(IX+d)
  case 0x5CE: t1=this.wz; this.w1(t1,this.r1(t1) |  0x02); this.cycles+=23; break; // SET 1,(IX+d)
  case 0x5D6: t1=this.wz; this.w1(t1,this.r1(t1) |  0x04); this.cycles+=23; break; // SET 2,(IX+d)
  case 0x5DE: t1=this.wz; this.w1(t1,this.r1(t1) |  0x08); this.cycles+=23; break; // SET 3,(IX+d)
  case 0x5E6: t1=this.wz; this.w1(t1,this.r1(t1) |  0x10); this.cycles+=23; break; // SET 4,(IX+d)
  case 0x5EE: t1=this.wz; this.w1(t1,this.r1(t1) |  0x20); this.cycles+=23; break; // SET 5,(IX+d)
  case 0x5F6: t1=this.wz; this.w1(t1,this.r1(t1) |  0x40); this.cycles+=23; break; // SET 6,(IX+d)
  case 0x5FE: t1=this.wz; this.w1(t1,this.r1(t1) |  0x80); this.cycles+=23; break; // SET 7,(IX+d)


  case 0x0DE: this.a= this.sbc1(this.a,this.next1()); this.cycles+= 7; break; // SBC A,n
  case 0x0DF: this.push(this.pc); this.pc = 0x18; this.cycles+=11; break; // RST 18H
  case 0x0E0: t1=5; if (!this.pf()) {this.pc=this.pop(); t1=11;} this.cycles+=t1; break; // RET PO
  case 0x0E1: this.HL(this.pop()); this.cycles+=10; break; // POP HL
  case 0x0E2: t1=this.next2(); if (!this.pf()) this.pc=t1; this.cycles+=10; break; // JP PO,nn
  case 0x0E3: t1=this.r2(this.sp); this.w2(this.sp,this.hl()); this.HL(t1); this.cycles+= 4; break; // EX (SP),HL ;
  case 0x0E4: t1=this.next2(); t2=11; 
              if (!this.pf()) {this.push(this.pc); this.pc=t1; t2=17;}
              this.cycles+=t2; break; // CALL PO,nn
  case 0x0E5: this.push(this.hl()); this.cycles+=11; break; // PUSH HL
  case 0x0E6: this.a= this.andByte(this.a,this.next1()); this.cycles+= 7; break; // AND n
  case 0x0E7: this.push(this.pc); this.pc=0x20; this.cycles+=11; break; // RST 20H
  case 0x0E8: t1=5; if (this.pf()) {this.pc=this.pop(); t1=11;} this.cycles+=t1; break; // RET PE
  case 0x0E9: this.pc = this.hl(); this.cycles+= 4; break; // JP (HL)
  case 0x0EA: t1=this.next2(); if (this.pf()) {this.pc=t1;} this.cycles+=10; break; // JP PE,nn
  case 0x0EB: t1=this.de(); this.DE(this.hl()); this.HL(t1); this.cycles+= 4; break; // EX DE,HL
  case 0x0EC: t1=this.next2(); t2=11;
              if (this.pf()) {this.push(this.pc); this.pc=t1; t2=17;}
              this.cycles+=t2; break; // CALL PE,nn

  // 23Oct17. gss.
  case 0x0ED: next= 0x200; break; // TODO: consider cycle=4 here then 4 less in 1xx cases. effect on INTs?

  case 0x240: this.b= this.in_c1(); break; // IN B,(C); only as doc'ed
  case 0x241: this.writePort(this.c,this.b); this.cycles+=12; break; // OUT (C),B
  case 0x242: this.HL(this.sbc2(this.hl(),this.bc())); this.cycles+=15; break; // SBC HL,BC
  case 0x243: this.w2(this.next2(),this.bc()); this.cycles+20; break; // LD (nn),BC
  case 0x244: this.a= neg1(this.a); this.cycles+ 8; break; // NEG
  case 0x245: this.pc= this.pop(); // RETN ; NMI
              //if (this->irq_device) this->irq_device->reti(); // notify daisy chain, if configured
              this.IFF1 = this.IFF2;
              this.cycles +=14; break;
  case 0x246: this.IM=0; this.cycles+=8; break;
  case 0x247: this.I=this.a; this.cycles+=9; break; // LD I,A
  case 0x248: this.c= this.in_c1(); break; // IN C,(C)
  case 0x249: this.writePort(this.c,this.c); this.cycles+=12; break; // OUT (C),C
  case 0x24A: this.HL(this.adc2(this.hl(),this.bc())); this.cycles+=15; break; // ADC HL,BC
  case 0x24B: this.BC(this.r2(this.next2())); this.cycles+=20; break; // LD BC,(nn)
  case 0x24D: this.pc= this.pop(); this.cycles+=20; break; // RETI
  case 0x24F: this.R= this.a; this.cycles+=20; break; // LD R,A
  
  case 0x250: this.d= this.in_c1(); break; // IN D,(C)
  case 0x251: this.writePort(this.c,this.d); this.cycles+=12; break; // OUT (C),D
  case 0x252: this.HL(this.sbc2(this.hl(),this.de())); this.cycles+=15; break; // SBC HL,DE
  case 0x253: this.w2(this.next2(),this.de()); this.cycles+20; break; // LD (nn),DE
  case 0x256: this.IM=1; this.cycles+=8; break;
  case 0x257: this.a= this.I; this.f=this.sziff1(this.I,this.IFF2)|(this.f&CF); this.cycles+=20; break; // LD A,I
  case 0x258: this.e= this.in_c1(); break; // IN E,(C)
  case 0x259: this.writePort(this.c,this.e); this.cycles+=12; break; // OUT (C),E
  case 0x25A: this.HL(this.adc2(this.hl(),this.de())); this.cycles+=15; break; // ADC HL,DE
  case 0x25B: this.DE(this.r2(this.next2())); this.cycles+=20; break; // LD DE,(nn)
  case 0x25E: this.IM=2; this.cycles+=8; break;
  case 0x25F: this.a= this.R; this.f=this.sziff1(this.R,this.IFF2)|(this.f&CF); this.cycles+=9; break; // LD A,R

  case 0x260: this.h= this.in_c1(); break; // IN H,(C)
  case 0x261: this.writePort(this.c,this.h); this.cycles+=12; break; // OUT (C),H
  case 0x262: this.HL(this.sbc2(this.hl(),this.hl())); this.cycles+=15; break; // SBC HL,HL
  case 0x263: this.w2(this.next2(),this.hl()); this.cycles+=20; break; // LD (nn),HL
  case 0x267: this.rrd(); this.cycles+=20; break; // RRD
  case 0x268: this.l= this.in_c1(); break; // IN L,(C)
  case 0x269: this.writePort(this.c,this.l); this.cycles+=12; break; // OUT (C),L
  case 0x26A: this.HL(this.adc2(this.hl(),this.hl())); this.cycles+=15; break; // ADC HL,HL
  case 0x26B: this.HL(this.r2(this.next2())); this.cycles+=20; break; // LD HL,(nn)
  case 0x26F: this.rld(); this.cycles+=20; break; // RLD [A,(HL)]

  case 0x272: this.HL(this.sbc2(this.hl(),this.sp)); this.cycles+=15; break; // SBC HL,SP
  case 0x273: this.w2(this.next2(),this.sp); this.cycles+=20; break; // LD (nn),SP
  case 0x278: this.a= this.in_c1(); break; // IN A,(C)
  case 0x279: this.writePort(this.c,this.a); this.cycles+=12; break; // OUT (C),A
  case 0x27A: this.HL(this.adc2(this.hl(),this.sp)); this.cycles+=15; break; // ADC HL,SP
  case 0x27B: this.sp= this.r2(this.next2()); this.cycles+=20; break; // LD SP,(nn)

  case 0x2A0: this.ldi( +1); this.cycles+=16; break; // LDI
  case 0x2A1: this.cpi( +1); this.cycles+=16; break; // CPI
  case 0x2A2: this.ini( +1); this.cycles+=16; break; // INI
  case 0x2A3: this.outi(+1); this.cycles+=16; break; // OUTI
  case 0x2A8: this.ldi( -1); this.cycles+=16; break; // LDD
  case 0x2A9: this.cpi( -1); this.cycles+=16; break; // CPD
  case 0x2AA: this.ini( -1); this.cycles+=16; break; // IND
  case 0x2AB: this.outi(-1); this.cycles+=16; break; // OUTD
  case 0x2B0: this.ldir(+1); break; // LDIR
  case 0x2B1: this.cpir(+1); break; // CPIR
  case 0x2B2: this.inir(+1); break; // INIR
  case 0x2B3: this.otir(+1); break; // OTIR
  case 0x2B8: this.ldir(-1); break; // LDDR
  case 0x2B9: this.cpir(-1); break; // CPDR
  case 0x2BA: this.inir(-1); break; // INDR
  case 0x2BB: this.otir(-1); break; // OTDR

  case 0x0EE: this.a = this.xorByte(this.a, this.next1()); this.cycles += 7; break;  // XOR  n
  case 0x0EF: this.push(this.pc); this.pc = 0x28; this.cycles += 11; break; // RST 28H

  case 0x0F0: if (!(this.f&SF)) {this.pc= this.pop(); this.cycles+=6; } // RET P
              this.cycles += 5; break;
  case 0x0F1: this.AF(this.pop()); this.cycles+=10; break; // POP AF
  case 0x0F2: t1=this.next2(); if (!(this.f&SF)) this.pc=t1; // JP P,nn
              this.cycles+=10; break;
  case 0x0F3: this.IFF1=0; this.IFF2=0; this.cycles += 4; break; // DI
  case 0x0F4: t1=this.next2(); t2=11;
              if (!(this.f&SF)) {this.push(this.pc); this.pc=t1; t2=17;} // CALL P,nn
              this.cycles +=t2; break;
  case 0x0F5: this.push(this.af()); this.cycles+=11; break; // PUSH AF
  case 0x0F6: this.a= this.orByte(this.a,this.next1()); this.cycles+= 7; break; // OR n
  case 0x0F7: this.push(this.pc); this.pc = 0x30; this.cycles += 11; break; // RST 30H
  case 0x0F8: t1=5; if (this.f&SF) {this.pc= this.pop(); t1=11; } this.cycles+=t1; break; // RET M
  case 0x0F9: this.sp= this.hl(); this.cycles+= 6; break; // LD SP,HL
  case 0x0FA: t1=this.next2(); if (this.f&SF) this.pc=t1; // JP M,nn
              this.cycles+=10; break;
  case 0x0FB: this.IFF1=1; this.IFF2=1; this.cycles+= 4; break; // EI
  case 0x0FC: t1=this.next2(); t2=11; // CALL M,nn
              if (this.f&SF) {this.push(this.pc); this.pc=t1; t2=17;}
              this.cycles +=t2; break;

  // 22Oct17. gss.
  case 0x0FD: next=0x400; break;
  case 0x409: this.IY(this.add2(this.iy(),this.bc())); this.cycles+=15; break; // ADD IY,BC
  case 0x419: this.IY(this.add2(this.iy(),this.de())); this.cycles+=15; break; // ADD IY,DE
  case 0x421: this.IY(this.next2()); this.cycles += 14; break; // LD IY,nn
  case 0x422: this.w2(this.next2(), this.iy()); this.cycles += 20; break; // LD (nn),IY
  case 0x423: this.IY((this.iy()+1)&0xFFFF); this.cycles+=10; break; // INC IY
  case 0x429: this.IY(this.add2(this.iy(),this.iy())); this.cycles+=15; break; // ADD IY,IY
  case 0x42A: t1=this.next2(); this.IY(this.r2(t1)); this.cycles+=20; break; // LD IY,(nn)
  case 0x42B: this.IY((this.iy()-1)&0xFFFF);  this.cycles+=10; break; // DEC IY
  case 0x434: t1=this._iyd(); this.w1(t1,this.inc1(this.r1(t1))); this.cycles+=23; break; // INC (IY+d)
  case 0x435: t1=this._iyd(); this.w1(t1,this.dec1(this.r1(t1))); this.cycles+=23; break; // DEC (IY+d)
  case 0x436: t1=this._iyd(); t2=this.next1(); this.w1(t1,t2); this.cycles+=19; break; // LD (IY+d),n
  case 0x439: this.IY(this.add2(this.iy(),this.sp())); this.cycles+=15; break; // ADD IY,SP
  case 0x446: t1=this._iyd(); this.b= this.r1(t1); this.cycles+=19; break; // LD B,(IY+d)
  case 0x44E: t1=this._iyd(); this.c= this.r1(t1); this.cycles+=19; break; // LD C,(IY+d)
  case 0x456: t1=this._iyd(); this.d= this.r1(t1); this.cycles+=19; break; // LD D,(IY+d)
  case 0x45E: t1=this._iyd(); this.e= this.r1(t1); this.cycles+=19; break; // LD E,(IY+d)
  case 0x466: t1=this._iyd(); this.h= this.r1(t1); this.cycles+=19; break; // LD H,(IY+d)
  case 0x46E: t1=this._iyd(); this.l= this.r1(t1); this.cycles+=19; break; // LD L,(IY+d)
  case 0x47E: t1=this._iyd(); this.a= this.r1(t1); this.cycles+=19; break; // LD A,(IY+d)
  case 0x470: t1=this._iyd(); this.w1(t1,this.b); this.cycles+=19; break; // LD (IY+d),B
  case 0x471: t1=this._iyd(); this.w1(t1,this.c); this.cycles+=19; break; // LD (IY+d),C
  case 0x472: t1=this._iyd(); this.w1(t1,this.d); this.cycles+=19; break; // LD (IY+d),D
  case 0x473: t1=this._iyd(); this.w1(t1,this.e); this.cycles+=19; break; // LD (IY+d),E
  case 0x474: t1=this._iyd(); this.w1(t1,this.h); this.cycles+=19; break; // LD (IY+d),H
  case 0x475: t1=this._iyd(); this.w1(t1,this.l); this.cycles+=19; break; // LD (IY+d),L
  case 0x477: t1=this._iyd(); this.w1(t1,this.a); this.cycles+=19; break; // LD (IY+d),A
  case 0x486: t1=this._iyd(); this.a= this.add1(this.a, this.r1(t1)); this.cycles+=19; break; // ADD (IY+d)
  case 0x48E: t1=this._iyd(); this.a= this.adc1(this.a, this.r1(t1)); this.cycles+=19; break; // ADC A,(IY+d); TODO or z80 adc8(b)
  case 0x496: t1=this._iyd(); this.a= this.sub1(this.a, this.r1(t1)); this.cycles+=19; break; // SUB (IY+d)
  case 0x49E: t1=this._iyd(); this.a= this.sbc1(this.a, this.r1(t1)); this.cycles+=19; break; // SBC A,(IY+d)
  case 0x4A6: t1=this._iyd(); this.a= this.andByte(this.a, this.r1(t1)); this.cycles+=19; break; // AND A,(IY+d)
  case 0x4AE: t1=this._iyd(); this.a= this.xorByte(this.a, this.r1(t1)); this.cycles+=19; break; // XOR A,(IY+d)
  case 0x4B6: t1=this._iyd(); this.a= this.orByte(this.a,  this.r1(t1)); this.cycles+=19; break; // OR (IY+d)
  case 0x4BE: t1=this._iyd(); this.sub1(this.a, this.r1(t1)); this.cycles+=19; break; // CP (IY+d)

  case 0x4CB: next= 0x500; this.wz= this._iyd(); break; // FD CB dd op; wz data pointer = IY+dd
  case 0x4DD: next= 0x300; break; // undoc. FD DD = forget the FD
  case 0x4E1: this.IY(this.pop()); this.cycles += 15; break; // POP IY
  case 0x4E5: this.push(this.iy()); this.cycles += 15; break; // PUSH IY
  case 0x4E9: this.pc=this.iy(); this.cycles+= 8; break; // JP IY
  case 0x4F9: this.sp=this.iy(); this.cycles+=10; break; // LD SP,IY

  case 0x0FE: this.sub1(this.a, this.next1()); this.cycles += 7; break; // CP n
  case 0x0FF: this.push(this.pc); this.pc=0x38; this.cycles+=11; break; // RST  38H

  default:    alert("Unsupported Z80 instruction: "+this.prefix+","+i.toString(16)); // gss
              this.cycles += 4;
              this.prefix=0; return false; // stop execution
  }
  this.prefix= next;
  return true; // go-on
};

// disassembler accesses RAM directly
//   just for the case of memory mapped IO, not to trigger IO!
Cpu.prototype.disassembleInstruction = function(addr) {
  var i = this.ram[addr];

  switch(i) {
  case 0x00:
    {
      // NOP
      var r = "NOP";
      return [addr+1, r];
    }
    break;
  case 0x01:
    {
      // LD BC,nn
      var r = "LD BC," + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0x02:
    {
      // LD (BC),A
      var r = "LD (BC),A";
      return [addr+1, r];
    }
    break;
  case 0x03:
    {
      // INC BC
      var r = "INC BC";
      return [addr+1, r];
    }
    break;
  case 0x04:
    {
      // INC  B
      var r = "INC B";
      return [addr+1, r];
    }
    break;
  case 0x05:
    {
      // DEC  B
      var r = "DEC B";
      return [addr+1, r];
    }
    break;
  case 0x06:
    {
      // LD   B,n
      var r = "LD B," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0x07:
    {
      // RLCA
      var r = "RLCA";
      return [addr+1, r];
    }
    break;
  case 0x09:
    {
      // ADD  HL,BC
      var r = "ADD HL,BC";
      return [addr+1, r];
    }
    break;
  case 0x0A:
    {
      // LD   A,(BC)
      var r = "LD A,(BC)";
      return [addr+1, r];
    }
    break;
  case 0x0B:
    {
      // DEC  BC
      var r = "DEC BC";
      return [addr+1, r];
   }
    break;
  case 0x0C:
    {
      // INC  C
      var r = "INC C";
      return [addr+1, r];
    }
    break;
  case 0x0D:
    {
      // DEC  C
      var r = "DEC C";
      return [addr+1, r];
    }
    break;
  case 0x0E:
    {
      // LD   C,n
      var r = "LD C," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0x0F:
    {
      // RRCA
      var r = "RRCA";
      return [addr+1, r];
    }
    break;
  case 0x11:
    {
      // LD   DE,nn
      var r = "LD DE," + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0x12:
    {
      // LD   (DE),A
      var r = "LD (DE),A";
      return [addr+1, r];
    }
    break;
  case 0x13:
    {
      // INC  DE
      var r = "INC DE";
      return [addr+1, r];
    }
    break;
  case 0x14:
    {
      // INC  D
      var r = "INC D";
      return [addr+1, r];
    }
    break;
  case 0x15:
    {
      // DEC  D
      var r = "DEC D";
      return [addr+1, r];
    }
    break;
  case 0x16:
    {
      // LD   D,n
      var r = "LD D," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0x17:
    {
      // RLA
      var r = "RLA";
      return [addr+1, r];
    }
    break;
  case 0x19:
    {
      // ADD  HL,DE
      var r = "ADD HL,DE";
      return [addr+1, r];
    }
    break;
  case 0x1A:
    {
      // LD   A,(DE)
      var r = "LD A,(DE)";
      return [addr+1, r];
    }
    break;
  case 0x1B:
    {
      // DEC  DE
      var r = "DEC DE";
      return [addr+1, r];
    }
    break;
  case 0x1C:
    {
      // INC  E
      var r = "INC E";
      return [addr+1, r];
    }
    break;
  case 0x1D:
    {
      // DEC  E
      var r = "DEC E";
      return [addr+1, r];
    }
    break;
  case 0x1E:
    {
      // LD   E,n
      var r = "LD E," + this.ram[addr+1];
      return [addr+2, r];
    }
    break;
  case 0x1F:
    {
      // RRA
      var r = "RRA";
      return [addr+1, r];
    }
    break;
  case 0x21:
    {
      // LD   HL,nn
      var r = "LD HL," + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0x22:
    {
      // LD   (nn),HL
      var r = "LD (" + this.r2(addr+1).toString(16) + "),HL";
      return [addr+3, r];
    }
    break;
  case 0x23:
    {
      // INC  HL
      var r = "INC HL";
      return [addr+1, r];
    }
    break;
  case 0x24:
    {
      // INC  H
      var r = "INC H";
      return [addr+1, r];
    }
    break;
  case 0x25:
    {
      // DEC  H
      var r = "DEC H";
      return [addr+1, r];
    }
    break;
  case 0x26:
    {
      // LD   H,n
      var r = "LD H," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0x27:
    {
      // DAA
      var r = "DAA";
      return [addr+1, r];
    }
    break;
  case 0x29:
    {
      // ADD  HL,HL
      var r = "ADD HL,HL";
      return [addr+1, r];
    }
    break;
  case 0x2A:
    {
      // LD   HL,(nn)
      var r = "LD HL,(" + this.r2(addr+1).toString(16) + ")";
      return [addr+3, r];
    }
    break;
  case 0x2B:
    {
      // DEC  HL
      var r = "DEC HL";
      return [addr+1, r];
    }
    break;
  case 0x2C:
    {
      // INC  L
      var r = "INC L";
      return [addr+1, r];
    }
    break;
  case 0x2D:
    {
      // DEC  L
      var r = "DEC L";
      return [addr+1, r];
    }
    break;
  case 0x2E:
    {
      // LD   L,n
      var r = "LD L," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0x2F:
    {
      // CPL
      var r = "CPL";
      return [addr+1, r];
    }
    break;
  case 0x31:
    {
      // LD   SP,nn
      var r = "LD SP," + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0x32:
    {
      // LD   (nn),A
      var r = "LD (" + this.r2(addr+1).toString(16) + "),A";
      return [addr+3, r];
    }
    break;
  case 0x33:
    {
      // INC  SP
      var r = "INC SP";
      return [addr+1, r];
    }
    break;
  case 0x34:
    {
      // INC  (HL)
      var r = "INC (HL)";
      return [addr+1, r];
    }
    break;
  case 0x35:
    {
      // DEC  (HL)
      var r = "DEC (HL)";
      return [addr+1, r];
    }
    break;
  case 0x36:
    {
      // LD   (HL),n
      var r = "LD (HL)," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0x37:
    {
      // SCF
      var r = "SCF";
      return [addr+1, r];
    }
    break;
  case 0x39:
    {
      // ADD  HL,SP
      var r = "ADD HL,SP";
      return [addr+1, r];
    }
    break;
  case 0x3A:
    {
      // LD   A,(nn)
      var r = "LD A,(" + this.r2(addr+1).toString(16) + ")";
      return [addr+3, r];
    }
    break;
  case 0x3B:
    {
      // DEC  SP
      var r = "DEC SP";
      return [addr+1, r];
    }
    break;
  case 0x3C:
    {
      // INC  A
      var r = "INC A";
      return [addr+1, r];
    }
    break;
  case 0x3D:
    {
      // DEC  A
      var r = "DEC A";
      return [addr+1, r];
    }
    break;
  case 0x3E:
    {
      // LD   A,n
      var r = "LD A," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0x3F:
    {
      // CCF
      var r = "CCF";
      return [addr+1, r];
    }
    break;
  case 0x40:
    {
      // LD   B,B
      var r = "LD B,B";
      return [addr+1, r];
    }
    break;
  case 0x41:
    {
      //LD   B,C
      var r = "LD B,C";
      return [addr+1, r];
    }
    break;
  case 0x42:
    {
      // LD   B,D
      var r = "LD B,D";
      return [addr+1, r];
    }
    break;
  case 0x43:
    {
      // LD   B,E
      var r = "LD B,E";
      return [addr+1, r];
    }
    break;
  case 0x44:
    {
      // LD   B,H
      var r = "LD B,H";
      return [addr+1, r];
    }
    break;
  case 0x45:
    {
      // LD   B,L
      var r = "LD B,L";
      return [addr+1, r];
    }
    break;
  case 0x46:
    {
      // LD   B,(HL)
      var r = "LD B,(HL)";
      return [addr+1, r];
    }
    break;
  case 0x47:
    {
      // LD   B,A
      var r = "LD B,A";
      return [addr+1, r];
    }
    break;
  case 0x48:
    {
      // LD   C,B
      var r = "LD C,B";
      return [addr+1, r];
    }
    break;
  case 0x49:
    {
      // LD   C,C
      var r = "LD C,C";
      return [addr+1, r];
    }
    break;
  case 0x4A:
    {
      // LD   C,D
      var r = "LD C,D";
      return [addr+1, r];
    }
    break;
  case 0x4B:
    {
      // LD   C,E
      var r = "LD C,E";
      return [addr+1, r];
    }
    break;
  case 0x4C:
    {
      // LD   C,H
      var r = "LD C,H";
      return [addr+1, r];
    }
    break;
  case 0x4D:
    {
      // LD   C,L
      var r = "LD C,L";
      return [addr+1, r];
    }
    break;
  case 0x4E:
    {
      // LD   C,(HL)
      var r = "LD C,(HL)";
      return [addr+1, r];
    }
    break;
  case 0x4F:
    {
      // LD   C,A
      var r = "LD C,A";
      return [addr+1, r];
    }
    break;
  case 0x50:
    {
      // LD   D,B
      var r = "LD D,B";
      return [addr+1, r];
    }
    break;
  case 0x51:
    {
      // LD   D,C
      var r = "LD D,C";
      return [addr+1, r];
    }
    break;
  case 0x52:
    {
      // LD   D,D
      var r = "LD D,D";
      return [addr+1, r];
    }
    break;
  case 0x53:
    {
      // LD   D,E
      var r = "LD D,E";
      return [addr+1, r];
    }
    break;
  case 0x54:
    {
      // LD   D,H
      var r = "LD D,H";
      return [addr+1, r];
    }
    break;
  case 0x55:
    {
      // LD   D,L
      var r = "LD D,L";
      return [addr+1, r];
    }
    break;
  case 0x56:
    {
      // LD   D,(HL)
      var r = "LD D,(HL)";
      return [addr+1, r];
    }
    break;
  case 0x57:
    {
      // LD   D,A
      var r = "LD D,A";
      return [addr+1, r];
    }
    break;
  case 0x58:
    {
      // LD   E,B
      var r = "LD E,B";
      return [addr+1, r];
    }
    break;
  case 0x59:
    {
      // LD   E,C
      var r = "LD E,C";
      return [addr+1, r];
    }
    break;
  case 0x5A:
    {
      // LD   E,D
      var r = "LD E,D";
      return [addr+1, r];
    }
    break;
  case 0x5B:
    {
      // LD   E,E
      var r = "LD E,E";
      return [addr+1, r];
    }
    break;
  case 0x5C:
    {
      // LD   E,H
      var r = "LD E,H";
      return [addr+1, r];
    }
    break;
  case 0x5D:
    {
      // LD   E,L
      var r = "LD E,L";
      return [addr+1, r];
    }
    break;
  case 0x5E:
    {
      // LD   E,(HL)
      var r = "LD E,(HL)";
      return [addr+1, r];
    }
    break;
  case 0x5F:
    {
      // LD   E,A
      var r = "LD E,A";
      return [addr+1, r];
    }
    break;
  case 0x60:
    {
      // LD   H,B
      var r = "LD H,B";
      return [addr+1, r];
    }
    break;
  case 0x61:
    {
      // LD   H,C
      var r = "LD H,C";
      return [addr+1, r];
    }
    break;
  case 0x62:
    {
      // LD   H,D
      var r = "LD H,D";
      return [addr+1, r];
    }
    break;
  case 0x63:
    {
      // LD   H,E
      var r = "LD H,E";
      return [addr+1, r];
    }
    break;
  case 0x64:
    {
      // LD   H,H
      var r = "LD H,H";
      return [addr+1, r];
    }
    break;
  case 0x65:
    {
      // LD   H,L
      var r = "LD H,L";
      return [addr+1, r];
    }
    break;
  case 0x66:
    {
      // LD   H,(HL)
      var r = "LD H,(HL)";
      return [addr+1, r];
    }
    break;
  case 0x67:
    {
      // LD   H,A
      var r = "LD H,A";
      return [addr+1, r];
    }
    break;
  case 0x68:
    {
      // LD   L,B
      var r = "LD L,B";
      return [addr+1, r];
    }
    break;
  case 0x69:
    {
      // LD   L,C
      var r = "LD L,C";
      return [addr+1, r];
    }
    break;
  case 0x6A:
    {
      // LD   L,D
      var r = "LD L,D";
      return [addr+1, r];
    }
    break;
  case 0x6B:
    {
      // LD   L,E
      var r = "LD L,E";
      return [addr+1, r];
    }
    break;
  case 0x6C:
    {
      // LD   L,H
      var r = "LD L,H";
      return [addr+1, r];
    }
    break;
  case 0x6D:
    {
      // LD   L,L
      var r = "LD L,L";
      return [addr+1, r];
    }
    break;
   case 0x6E:
   {
      // LD   L,(HL)
      var r = "LD L,(HL)";
      return [addr+1, r];
   }
   break;
  case 0x6F:
    {
      // LD   L,A
      var r = "LD L,A";
      return [addr+1, r];
    }
    break;

  case 0x70:
    {
      // LD   (HL),B
      var r = "LD (HL),B";
      return [addr+1, r];
    }
    break;
  case 0x71:
    {
      // LD   (HL),C
      var r = "LD (HL),C";
      return [addr+1, r];
    }
    break;
  case 0x72:
    {
      // LD   (HL),D
      var r = "LD (HL),D";
      return [addr+1, r];
    }
    break;
  case 0x73:
    {
      // LD   (HL),E
      var r = "LD (HL),E";
      return [addr+1, r];
    }
    break;
  case 0x74:
    {
      // LD   (HL),H
      var r = "LD (HL),H";
      return [addr+1, r];
    }
    break;
  case 0x75:
    {
      // LD   (HL),L
      var r = "LD (HL),L";
      return [addr+1, r];
    }
    break;
  case 0x76:
    {
      // HALT
      var r = "HALT";
      return [addr+1, r];
    }
    break;
  case 0x77:
    {
      // LD   (HL),A
      var r = "LD (HL),A";
      return [addr+1, r];
    }
    break;
  case 0x78:
    {
      // LD   A,B
      var r = "LD A,B";
      return [addr+1, r];
    }
    break;
  case 0x79:
    {
      // LD   A,C
      var r = "LD A,C";
      return [addr+1, r];
    }
    break;
  case 0x7A:
    {
      // LD   A,D
      var r = "LD A,D";
      return [addr+1, r];
    }
    break;
  case 0x7B:
    {
      // LD   A,E
      var r = "LD A,E";
      return [addr+1, r];
    }
    break;
  case 0x7C:
    {
      // LD   A,H
      var r = "LD A,H";
      return [addr+1, r];
    }
    break;
  case 0x7D:
    {
      // LD   A,L
      var r = "LD A,L";
      return [addr+1, r];
    }
    break;
  case 0x7E:
    {
      // LD   A,(HL)
      var r = "LD A,(HL)";
      return [addr+1, r];
    }
    break;
  case 0x7F:
    {
      // LD   A,A
      var r = "LD A,A";
      return [addr+1, r];
    }
    break;
  case 0x80:
    {
      // ADD  A,B
      var r = "ADD A,B";
      return [addr+1, r];
    }
    break;
  case 0x81:
    {
      // ADD  A,C
      var r = "ADD A,C";
      return [addr+1, r];
    }
    break;
  case 0x82:
    {
      // ADD  A,D
      var r = "ADD A,D";
      return [addr+1, r];
    }
    break;
  case 0x83:
    {
      // ADD  A,E
      var r = "ADD A,E";
      return [addr+1, r];
    }
    break;
  case 0x84:
    {
      // ADD  A,H
      var r = "ADD A,H";
      return [addr+1, r];
    }
    break;
  case 0x85:
    {
      // ADD  A,L
      var r = "ADD A,L";
      return [addr+1, r];
    }
    break;
  case 0x86:
    {
      // ADD  A,(HL)
      var r = "ADD A,(HL)";
      return [addr+1, r];
    }
    break;
  case 0x87:
    {
      // ADD  A,A
      var r = "ADD A,A";
      return [addr+1, r];
    }
    break;
  case 0x88:
    {
      // ADC  A,B
      var r = "ADC A,B";
      return [addr+1, r];
    }
    break;
    case 0x89:
      {
      // ADC  A,C
      var r = "ADC A,C";
      return [addr+1, r];
    }
    break;
  case 0x8A:
    {
      // ADC  A,D
      var r = "ADC A,D";
      return [addr+1, r];
    }
    break;
    case 0x8B:
      {
      // ADC  A,E
      var r = "ADC A,E";
      return [addr+1, r];
    }
    break;
  case 0x8C:
    {
      // ADC  A,H
      var r = "ADC A,H";
      return [addr+1, r];
    }
    break;
  case 0x8D:
    {
      // ADC  A,L
      var r = "ADC A,L";
      return [addr+1, r];
    }
    break;
  case 0x8E:
    {
      // ADC  A,(HL)
      var r = "ADC A,(HL)";
      return [addr+1, r];
    }
    break;
  case 0x8F:
    {
      // ADC  A,A
      var r = "ADC A,A";
      return [addr+1, r];
    }
    break;
  case 0x90:
    {
      // SUB  B
      var r = "SUB B";
      return [addr+1, r];
    }
    break;
  case 0x91:
    {
      // SUB  C
      var r = "SUB C";
      return [addr+1, r];
    }
    break;
  case 0x92:
    {
      // SUB  D
      var r = "SUB D";
      return [addr+1, r];
    }
    break;
  case 0x93:
    {
      // SUB  E
      var r = "SUB E";
      return [addr+1, r];
    }
    break;
  case 0x94:
    {
      // SUB  H
      var r = "SUB H";
      return [addr+1, r];
    }
    break;
  case 0x95:
    {
      // SUB  L
      var r = "SUB L";
      return [addr+1, r];
    }
    break;
  case 0x96:
    {
      // SUB  (HL)
      var r = "SUB (HL)";
      return [addr+1, r];
    }
    break;
  case 0x97:
    {
      // SUB  A
      var r = "SUB A";
      return [addr+1, r];
    }
    break;
  case 0x98:
    {
      // SBC  A,B
      var r = "SBC A,B";
      return [addr+1, r];
    }
    break;
  case 0x99:
    {
      // SBC  A,C
      var r = "ABC A,C";
      return [addr+1, r];
    }
    break;
  case 0x9A:
    {
      // SBC  A,D
      var r = "SBC A,D";
      return [addr+1, r];
    }
    break;
  case 0x9B:
    {
      // SBC  A,E
      var r = "SBC A,E";
      return [addr+1, r];
    }
    break;
  case 0x9C:
    {
      // SBC  A,H
      var r = "SBC A,H";
      return [addr+1, r];
    }
    break;
  case 0x9D:
    {
      // SBC  A,L
      var r = "SBC A,L";
      return [addr+1, r];
    }
    break;
  case 0x9E:
    {
      //  SBC  A,(HL)
      var r = "SBC A,(HL)";
      return [addr+1, r];
    }
    break;
  case 0x9F:
    {
      // SBC  A,A
      var r = "SBC A,A";
      return [addr+1, r];
    }
    break;
  case 0xA0:
    {
      // AND  B
      var r = "AND B";
      return [addr+1, r];
    }
    break;
  case 0xA1:
    {
      // AND  C
      var r = "AND C";
      return [addr+1, r];
    }
    break;
  case 0xA2:
    {
      // AND  D
      var r = "AND D";
      return [addr+1, r];
    }
    break;
  case 0xA3:
    {
      // AND  E
      var r = "AND E";
      return [addr+1, r];
    }
    break;
  case 0xA4:
    {
      // AND  H
      var r = "AND H";
      return [addr+1, r];
    }
    break;
  case 0xA5:
    {
      // AND  L
      var r = "AND L";
      return [addr+1, r];
    }
    break;
  case 0xA6:
    {
      // AND  (HL)
      var r = "AND (HL)";
      return [addr+1, r];
    }
    break;
  case 0xA7:
    {
      // AND  A
      var r = "AND A";
      return [addr+1, r];
    }
    break;
  case 0xA8:
    {
      // XOR  B
      var r = "XOR B";
      return [addr+1, r];
    }
    break;
  case 0xA9:
    {
      // XOR  C
      var r = "XOR C";
      return [addr+1, r];
    }
    break;
  case 0xAA:
    {
      // XOR  D
      var r = "XOR D";
      return [addr+1, r];
    }
    break;
  case 0xAB:
    {
      // XOR  E
      var r = "XOR E";
      return [addr+1, r];
    }
    break;
  case 0xAC:
    {
      // XOR  H
      var r = "XOR H";
      return [addr+1, r];
    }
    break;
  case 0xAD:
    {
      // XOR  L
      var r = "XOR L";
      return [addr+1, r];
    }
    break;
  case 0xAE:
    {
      // XOR  (HL)
      var r = "XOR (HL)";
      return [addr+1, r];
    }
    break;
  case 0xAF:
    {
      // XOR  A
      var r = "XOR A";
      return [addr+1, r];
    }
    break;
  case 0xB0:
    {
      // OR  B
      var r = "OR B";
      return [addr+1, r];
    }
    break;
  case 0xB1:
    {
      // OR  C
      var r = "OR C";
      return [addr+1, r];
    }
    break;
  case 0xB2:
    {
      // OR  D
      var r = "OR D";
      return [addr+1, r];
    }
    break;
  case 0xB3:
    {
      // OR  E
      var r = "OR E";
      return [addr+1, r];
    }
    break;
  case 0xB4:
    {
      // OR  H
      var r = "OR H";
      return [addr+1, r];
    }
    break;
  case 0xB5:
    {
      // OR  L
      var r = "OR L";
      return [addr+1, r];
    }
    break;
  case 0xB6:
    {
      //  OR   (HL)
      var r = "OR (HL)";
      return [addr+1, r];
    }
    break;
  case 0xB7:
    {
      // OR  A
      var r = "OR A";
      return [addr+1, r];
    }
    break;
  case 0xB8:
    {
      //  CP   B
      var r = "CP B";
      return [addr+1, r];
    }
    break;
  case 0xB9:
    {
      //  CP   C
      var r = "CP C";
      return [addr+1, r];
    }
    break;
  case 0xBA:
    {
      //  CP   D
      var r = "CP D";
      return [addr+1, r];
    }
    break;
  case 0xBB:
    {
      //  CP   E
      var r = "CP E";
      return [addr+1, r];
    }
    break;
  case 0xBC:
    {
      //  CP   H
      var r = "CP H";
      return [addr+1, r];
    }
    break;
  case 0xBD:
    {
      //  CP   L
      var r = "CP L";
      return [addr+1, r];
    }
    break;
  case 0xBE:
    {
      // CP   (HL)
      var r = "CP (HL)";
      return [addr+1, r];
    }
    break;
  case 0xBF:
    {
      //  CP   A
      var r = "CP A";
      return [addr+1, r];
    }
    break;
  case 0xC0:
    {
      //  RET  NZ
      var r = "RET NZ";
      return [addr+1, r];
    }
    break;
  case 0xC1:
    {
      //  POP  BC
      var r = "POP BC";
      return [addr+1, r];
    }
    break;
  case 0xC2:
    {
      // JP   NZ,nn
      var r = "JP NZ," + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xC3:
    {
      //  JP   nn
      var r = "JP " + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xC4:
    {
      //  CALL NZ,nn
      var r = "CALL NZ," + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xC5:
    {
      //  PUSH BC
      var r = "PUSH BC";
      return [addr+1, r];
    }
    break;
  case 0xC6:
    {
      //  ADD  A,n
      var r = "ADD A," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0xC7:
    {
      // RST  0
      var r = "RST 0";
      return [addr+1, r];
    }
    break;
  case 0xC8:
    {
      // RET Z
      var r = "RET Z";
      return [addr+1, r];
    }
    break;
  case 0xC9:
    {
      //// RET  nn
      //var r = "RET " + this.r2(addr+1).toString(16);
      //return [addr+3, r];
      // RET
      var r = "RET";
      return [addr+1, r];
    }
    break;
  case 0xCA:
    {
      // JP   Z,nn
      var r = "JP Z," + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xCC:
    {
      //  CALL Z,nn
      var r = "CALL Z," + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xCD:
    {
      // CALL nn
      var r = "CALL " + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xCE:
    {
      // ADC  A,n
      var r = "ADC A," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0xCF:
    {
      // RST  8
      var r = "RST 8";
      return [addr+1, r];
    }
    break;
  case 0xD0:
    {
      // RET NC
      var r = "RET NC";
      return [addr+1, r];
    }
    break;
  case 0xD1:
    {
      // POP DE
      var r = "POP DE";
      return [addr+1, r];
    }
    break;
  case 0xD2:
    {
      // JP   NC,nn
      var r = "JP NC," + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xD3:
    {
      // OUT  (n),A
      var r = "OUT (" + this.ram[addr+1].toString(16) + "),A";
      return [addr+2, r];
    }
    break;
  case 0xD4:
    {
      //  CALL NC,nn
      var r = "CALL NC," + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xD5:
    {
      //  PUSH DE
      var r = "PUSH DE";
      return [addr+1, r];
    }
    break;
  case 0xD6:
    {
      // SUB  n
      var r = "SUB " + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0xD7:
    {
      // RST  10H
      var r = "RST 10H";
      return [addr+1, r];
    }
    break;
  case 0xD8:
    {
      // RET C
      var r = "RET C";
      return [addr+1, r];
    }
    break;
  case 0xDA:
    {
      // JP   C,nn
      var r = "JP C," + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xDB:
    {
      // IN   A,(n)
      var r = "IN A,(" + this.ram[addr+1].toString(16) + ")";
      return [addr+2, r];
    }
    break;
  case 0xDC:
    {
      //  CALL C,nn
      var r = "CALL C," + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xDE:
    {
      // SBC  A,n
      var r = "SBC A," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0xDF:
    {
      // RST  18H
      var r = "RST 18H";
      return [addr+1, r];
    }
    break;
  case 0xE0:
    {
      // RET PO
      var r = "RET PO";
      return [addr+1, r];
    }
    break;
  case 0xE1:
    {
      // POP HL
      var r = "POP HL";
      return [addr+1, r];
    }
    break;
  case 0xE2:
    {
      // JP   PO,nn
      var r = "JP PO," + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xE3:
    {
      // EX   (SP),HL ;
      var r = "EX (SP),HL";
      return [addr+1, r];
    }
    break;
  case 0xE4:
    {
      //  CALL PO,nn
      var r = "CALL PO," + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xE5:
    {
      //  PUSH HL
      var r = "PUSH HL";
      return [addr+1, r];
    }
    break;
  case 0xE6:
    {
      // AND  n
      var r = "AND " + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0xE7:
    {
      // RST  20H
      var r = "RST 20H";
      return [addr+1, r];
    }
    break;
  case 0xE8:
    {
      // RET PE
      var r = "RET PE";
      return [addr+1, r];
    }
    break;
  case 0xE9:
    {
      // JP   (HL)
      var r = "JMP (HL)";
      return [addr+1, r];
    }
    break;
  case 0xEA:
    {
      // JP   PE,nn
      var r = "JP PE," + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xEB:
    {
      // EX   DE,HL
      var r = "EX DE,HL";
      return [addr+1, r];
    }
    break;
  case 0xEC:
    {
      //  CALL PE,nn
      var r = "CALL PE,nn" + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xEE:
    {
      // XOR  n
      var r = "XOR " + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0xEF:
    {
      // RST  28H
      var r = "RST 28H";
      return [addr+1, r];
    }
    break;
  case 0xF0:
    {
      // RET P
      var r = "RET P";
      return [addr+1, r];
    }
    break;
  case 0xF1:
    {
      // POP AF
      var r = "POP AF";
      return [addr+1, r];
    }
    break;
  case 0xF2:
    {
      // JP   P,nn
      var r = "JP P," + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xF3:
    {
      // DI
      var r = "DI";
      return [addr+1, r];
    }
    break;
  case 0xF4:
      {
      //  CALL P,nn
      var r = "CALL P,nn" + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xF5:
    {
      //  PUSH AF
      var r = "PUSH AF";
      return [addr+1, r];
    }
    break;
  case 0xF6:
    {
      // OR   n
      var r = "OR " + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0xF7:
    {
      // RST  30H
      var r = "RST 30H";
      return [addr+1, r];
    }
    break;
  case 0xF8:
    {
      // RET M
      var r = "RET M";
      return [addr+1, r];
    }
    break;
  case 0xF9:
    {
      // LD   SP,HL
      var r = "LD SP,HL";
      return [addr+1, r];
    }
    break;
  case 0xFA:
    {
      // JP   M,nn
      var r = "JP M," + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xFB:
    {
      // EI
      var r = "EI";
      return [addr+1, r];
    }
    break;
  case 0xFC:
    {
      //  CALL M,nn
      var r = "CALL M," + this.r2(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xFE:
    {
      // CP   n
      var r = "CP " + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0xFF:
    {
      // RST  38H
      var r = "RST 38H";
      return [addr+1, r];
    }
    break;
  default:
    {
      // illegal
      var r = "ILLEGAL";
      return [addr+1, r];
    }
    break;

  }
};

Cpu.prototype.disassemble1 = function(addr) {
  var r = [];
  var d = this.disassembleInstruction(addr);
  r.push(pad(addr.toString(16), 4));
  r.push(": ");
  for(var j = 0; j < d[0]-addr; j++)
    r.push(pad(this.ram[addr+j].toString(16), 2));
  while(j++ < 3)
    r.push("  ");
  r.push(" ");
  r.push(d[1]);
  return [d[0], r.join("")];
};

Cpu.prototype.disassemble = function(addr) {
  var r = [];
  for(var i=0; i < 16; ++i) {
    var l = this.disassemble1(addr);
    r.push(l[1]);
    r.push("\r\n");
    addr = l[0];
  }
  return [r.join(""), addr];
};

Cpu.prototype.setRegisters = function(r) {
  var s = "";
  for (var i=1; i < r.length; i+=2) {
    var reg = r[i].toLowerCase();
    var n = parseInt(r[i+1], 16);
    //s += " " + reg +"="+ n;
    switch (reg) {
    case 'a':
      this.a = n & 0xFF;
      break;
    case 'b':
      this.b = n & 0xFF;
      break;
    case 'c':
      this.c = n & 0xFF;
      break;
    case 'd':
      this.d = n & 0xFF;
      break;
    case 'e':
      this.e = n & 0xFF;
      break;
    case 'h':
      this.h = n & 0xFF;
      break;
    case 'l':
      this.l = n & 0xFF;
      break;
    case 'f':
      this.f = n & 0xFF;
      break;
    case 'fc':
      if (n&1) {this.set(CARRY)} else {this.clear(CARRY)};
      break;
    case 'fp':
      if (n&1) {this.set(PARITY)} else {this.clear(PARITY)};
      break;
    case 'fh':
      if (n&1) {this.set(HALFCARRY)} else {this.clear(HALFCARRY)};
      break;
    case 'fz':
      if (n&1) {this.set(ZERO)} else {this.clear(ZERO)};
      break;
    case 'fs':
      if (n&1) {this.set(SIGN)} else {this.clear(SIGN)};
      break;
    case 'af':
      this.AF(n);
      break
    case 'bc':
      this.BC(n);
      break
    case 'de':
      this.DE(n);
      break
    case 'hl':
      this.HL(n);
      break
    case 'sp':
      this.sp = n & 0xFFFF;
      break;
    case 'pc':
      this.pc = n & 0xFFFF;
      break;
    default:
      s += " unknown register " + reg;
    }
  }
  if (s) s+='\r\n';
  return s;
};

// vim: set shiftwidth=2 :
