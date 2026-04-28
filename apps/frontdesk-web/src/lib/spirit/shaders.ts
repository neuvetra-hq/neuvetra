// Passthrough vertex shader for GPGPU quad rendering
export const QUAD_VERT = /* glsl */`
attribute vec3 position;
void main() {
  gl_Position = vec4(position, 1.0);
}
`

// Copy fragment shader (used to init position render targets)
export const THROUGH_FRAG = /* glsl */`
precision highp float;
uniform vec2 resolution;
uniform sampler2D texture;
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  gl_FragColor = texture2D(texture, uv);
}
`

// Core physics fragment shader.
// Simplex noise derivatives and curl noise are inlined from upstream GLSL helpers.
// Each frame reads particle position + life from texturePosition,
// applies curl noise displacement + attraction toward mouse3d, writes result.
export const POSITION_FRAG = /* glsl */`
precision highp float;
uniform vec2 resolution;
uniform sampler2D texturePosition;
uniform sampler2D textureDefaultPosition;
uniform float time;
uniform float speed;
uniform float dieSpeed;
uniform float radius;
uniform float curlSize;
uniform float attraction;
uniform float initAnimation;
uniform vec3 mouse3d;

// ── simplex noise derivatives (4D) ───────────────────────────────────────────
vec4 sn_mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}
float sn_mod289f(float x){return x-floor(x*(1./289.))*289.;}
vec4 sn_permv4(vec4 x){return sn_mod289v4(((x*34.)+1.)*x);}
float sn_permf(float x){return sn_mod289f(((x*34.)+1.)*x);}
vec4 sn_taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float sn_taylorInvSqrtF(float r){return 1.79284291400159-0.85373472095314*r;}
vec4 sn_grad4(float j,vec4 ip){
  const vec4 ones=vec4(1.,1.,1.,-1.);
  vec4 p,s;
  p.xyz=floor(fract(vec3(j)*ip.xyz)*7.)*ip.z-1.;
  p.w=1.5-dot(abs(p.xyz),ones.xyz);
  s=vec4(lessThan(p,vec4(0.)));
  p.xyz=p.xyz+(s.xyz*2.-1.)*s.www;
  return p;
}
#define SN_F4 0.309016994374947451
vec4 snoise4(vec4 v){
  const vec4 C=vec4(.138196601125011,.276393202250021,.414589803375032,-.447213595499958);
  vec4 i=floor(v+dot(v,vec4(SN_F4)));
  vec4 x0=v-i+dot(i,C.xxxx);
  vec4 i0;
  vec3 isX=step(x0.yzw,x0.xxx);
  vec3 isYZ=step(x0.zww,x0.yyz);
  i0.x=isX.x+isX.y+isX.z;
  i0.yzw=1.-isX;
  i0.y+=isYZ.x+isYZ.y;
  i0.zw+=1.-isYZ.xy;
  i0.z+=isYZ.z;
  i0.w+=1.-isYZ.z;
  vec4 i3=clamp(i0,0.,1.);
  vec4 i2=clamp(i0-1.,0.,1.);
  vec4 i1=clamp(i0-2.,0.,1.);
  vec4 x1=x0-i1+C.xxxx;
  vec4 x2=x0-i2+C.yyyy;
  vec4 x3=x0-i3+C.zzzz;
  vec4 x4=x0+C.wwww;
  i=sn_mod289v4(i);
  float j0=sn_permf(sn_permf(sn_permf(sn_permf(i.w)+i.z)+i.y)+i.x);
  vec4 j1=sn_permv4(sn_permv4(sn_permv4(sn_permv4(
    i.w+vec4(i1.w,i2.w,i3.w,1.))+
    i.z+vec4(i1.z,i2.z,i3.z,1.))+
    i.y+vec4(i1.y,i2.y,i3.y,1.))+
    i.x+vec4(i1.x,i2.x,i3.x,1.));
  vec4 ip=vec4(1./294.,1./49.,1./7.,0.);
  vec4 p0=sn_grad4(j0,ip);
  vec4 p1=sn_grad4(j1.x,ip);
  vec4 p2=sn_grad4(j1.y,ip);
  vec4 p3=sn_grad4(j1.z,ip);
  vec4 p4=sn_grad4(j1.w,ip);
  vec4 norm=sn_taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  p4*=sn_taylorInvSqrtF(dot(p4,p4));
  vec3 v0=vec3(dot(p0,x0),dot(p1,x1),dot(p2,x2));
  vec2 v1=vec2(dot(p3,x3),dot(p4,x4));
  vec3 m0=max(.5-vec3(dot(x0,x0),dot(x1,x1),dot(x2,x2)),0.);
  vec2 m1=max(.5-vec2(dot(x3,x3),dot(x4,x4)),0.);
  vec3 t0=-6.*m0*m0*v0;
  vec2 t1=-6.*m1*m1*v1;
  vec3 mm0=m0*m0*m0;
  vec2 mm1=m1*m1*m1;
  float dx=t0[0]*x0.x+t0[1]*x1.x+t0[2]*x2.x+t1[0]*x3.x+t1[1]*x4.x+mm0[0]*p0.x+mm0[1]*p1.x+mm0[2]*p2.x+mm1[0]*p3.x+mm1[1]*p4.x;
  float dy=t0[0]*x0.y+t0[1]*x1.y+t0[2]*x2.y+t1[0]*x3.y+t1[1]*x4.y+mm0[0]*p0.y+mm0[1]*p1.y+mm0[2]*p2.y+mm1[0]*p3.y+mm1[1]*p4.y;
  float dz=t0[0]*x0.z+t0[1]*x1.z+t0[2]*x2.z+t1[0]*x3.z+t1[1]*x4.z+mm0[0]*p0.z+mm0[1]*p1.z+mm0[2]*p2.z+mm1[0]*p3.z+mm1[1]*p4.z;
  float dw=t0[0]*x0.w+t0[1]*x1.w+t0[2]*x2.w+t1[0]*x3.w+t1[1]*x4.w+mm0[0]*p0.w+mm0[1]*p1.w+mm0[2]*p2.w+mm1[0]*p3.w+mm1[1]*p4.w;
  return vec4(dx,dy,dz,dw)*49.;
}

// ── 3-octave curl noise ───────────────────────────────────────────────────────
vec3 curl(vec3 p,float noiseTime,float persistence){
  vec4 xD=vec4(0.),yD=vec4(0.),zD=vec4(0.);
  for(int i=0;i<3;++i){
    float tw=pow(2.,float(i));
    float sc=.5*tw*pow(persistence,float(i));
    xD+=snoise4(vec4(p*tw,noiseTime))*sc;
    yD+=snoise4(vec4((p+vec3(123.4,129845.6,-1239.1))*tw,noiseTime))*sc;
    zD+=snoise4(vec4((p+vec3(-9519.,9051.,-123.))*tw,noiseTime))*sc;
  }
  return vec3(zD[1]-yD[2],xD[2]-zD[0],yD[0]-xD[1]);
}

// ── main: update position + life ──────────────────────────────────────────────
void main(){
  vec2 uv=gl_FragCoord.xy/resolution.xy;
  vec4 positionInfo=texture2D(texturePosition,uv);
  vec3 position=mix(vec3(0.,-200.,0.),positionInfo.xyz,smoothstep(0.,.3,initAnimation));
  float life=positionInfo.a-dieSpeed;
  vec3 followPos=mix(vec3(0.,-(1.-initAnimation)*200.,0.),mouse3d,smoothstep(.2,.7,initAnimation));
  if(life<0.){
    positionInfo=texture2D(textureDefaultPosition,uv);
    position=positionInfo.xyz*(1.+sin(time*15.)*.2+(1.-initAnimation))*.4*radius;
    position+=followPos;
    life=.5+fract(positionInfo.w*21.4131+time);
  } else {
    vec3 delta=followPos-position;
    position+=delta*(.005+life*.01)*attraction*(1.-smoothstep(50.,350.,length(delta)))*speed;
    position+=curl(position*curlSize,time,.1+(1.-life)*.1)*speed;
  }
  gl_FragColor=vec4(position,life);
}
`

// Point particle vertex — position.xy = FBO UV, reads actual position from texture
export const PARTICLES_VERT = /* glsl */`
uniform sampler2D texturePosition;
varying float vLife;
void main(){
  vec4 positionInfo=texture2D(texturePosition,position.xy);
  vec4 mvPosition=modelViewMatrix*vec4(positionInfo.xyz,1.);
  vLife=positionInfo.w;
  gl_PointSize=1300./length(mvPosition.xyz)*smoothstep(0.,.2,positionInfo.w);
  gl_Position=projectionMatrix*mvPosition;
}
`

// Triangle particle vertex — fboUV samples the position texture;
// position and positionFlip are 2D triangle corner offsets that flip each frame.
export const TRIANGLES_VERT = /* glsl */`
uniform sampler2D texturePosition;
uniform float flipRatio;
uniform mat4 cameraMatrix;
attribute vec3 positionFlip;
attribute vec2 fboUV;
varying float vLife;
void main(){
  vec4 positionInfo=texture2D(texturePosition,fboUV);
  vec4 mvPosition=modelViewMatrix*vec4(positionInfo.xyz,1.);
  vLife=positionInfo.w;
  mvPosition+=vec4((position+(positionFlip-position)*flipRatio)*smoothstep(0.,.2,positionInfo.w),0.);
  gl_Position=projectionMatrix*mvPosition;
}
`

// Shared fragment shader — color interpolated from life value
export const PARTICLES_FRAG = /* glsl */`
precision highp float;
varying float vLife;
uniform vec3 color1;
uniform vec3 color2;
void main(){
  vec3 color=mix(color2,color1,smoothstep(0.,.7,vLife));
  gl_FragColor=vec4(color,1.);
}
`
