

document.addEventListener('DOMContentLoaded', function() {
    const ele = document.getElementById('RIGHT');

	ele.scrollTop  = ($('#ball').getBoundingClientRect().height - $('#RIGHT').offsetHeight)/2;
    ele.scrollLeft = ($('#ball').getBoundingClientRect().width - $('#RIGHT').offsetWidth)/2;

    ele.style.cursor = 'grab';

    let pos = { top: 0, left: 0, x: 0, y: 0 };

    const mouseDownHandler = function(e) {
        ele.style.cursor = 'grabbing';
        ele.style.userSelect = 'none';

        pos = {
            left: ele.scrollLeft,
            top: ele.scrollTop,
            x: e.clientX,
            y: e.clientY,
        };

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    };

    const mouseMoveHandler = function(e) {
        const dx = e.clientX - pos.x;
        const dy = e.clientY - pos.y;
        ele.scrollTop = pos.top - dy;
        ele.scrollLeft = pos.left - dx;
		
    };

    const mouseUpHandler = function() {
        ele.style.cursor = 'grab';
        ele.style.removeProperty('user-select');

        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    };

    ele.addEventListener('mousedown', mouseDownHandler);
});



function endslide(){

$('#current').innerHTML="`f(x)="+$('#exp').value+"`";

var math = document.getElementById("current");
MathJax.Hub.Queue(["Typeset",MathJax.Hub,math]);

}















var nm=1;

function drawrule(){

$('#rule').innerHTML='';
v = ($('#ball').getBoundingClientRect().height/2);
z = ($('#ball').getBoundingClientRect().width/2) 
$('#rule').innerHTML+="<text class=small x="+(z+10)+"  y="+(v+20)+">0</text>"

for(i=2;i<50;i+=2){$('#rule').innerHTML+="<text class=small x="+(z+(i*38))+"  y="+(v+20)+">"+i/nm+"</text>";}

for(i=-2;i>-50;i-=2){$('#rule').innerHTML+="<text class=small x="+(z+(i*38))+"  y="+(v+20)+">"+i/nm+"</text>";}

for(i=2;i<50;i+=2){$('#rule').innerHTML+="<text class=small x="+(z+10)+"  y="+(v+(i*38))+">"+(-i/nm)+"</text>";}

for(i=-2;i>-50;i-=2){$('#rule').innerHTML+="<text class=small x="+(z+10)+"  y="+(v+(i*38))+">"+(-i/nm)+"</text>";}
}





function resizeplus(){

//$('#ball').style.backgroundSize= parseFloat($('#ball').style.backgroundSize)*2 +'px'

sqsize=sqsize*2;
nm*= 2;
simple()
drawrule()
}


function resizeminus(){
//$('#ball').style.backgroundSize= parseFloat($('#ball').style.backgroundSize)/2 +'px'

sqsize=sqsize/2;
nm/= 2;

simple()
drawrule()
}
