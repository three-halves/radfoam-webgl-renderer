import {load} from '@loaders.gl/core';
import {PLYLoader} from '@loaders.gl/ply';
import '@loaders.gl/polyfills';
import {createVolumeTextures } from './textureHelper.js';
import { dist3 } from './utils.js';

// Globals
// Can be used with other radfoam PLY files that have adjacency data
const filePath = '../bonsai/scene.ply';

var gl = null;
var program = null;

var uniformLocations = {};

var quadBuffer = null;
var uvBuffer = null;
var quadDrawCount = 6;

var plyData = null;
var adjData = null;

// camera data
var camera = {
    x: 0,
    y: 0,
    z: -50,
}

// camera controls
document.getElementById("z-slider").addEventListener("change", (event) => {
    camera.z = parseFloat(event.target.value);
    updateCameraTransform();
    console.log(`Camera Z: ${camera.z}`);
});

document.getElementById("y-slider").addEventListener("change", (event) => {
    camera.y = parseFloat(event.target.value);
    updateCameraTransform();
});

document.getElementById("x-slider").addEventListener("change", (event) => {
    camera.x = parseFloat(event.target.value);
    updateCameraTransform();
});

function updateCameraTransform()
{
    SHADER_UNIFORMS.Camera2WorldMatrix.set([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        camera.x, camera.y, camera.z, 1
    ]
    );
}

const SHADER_UNIFORMS = {
    Camera2WorldMatrix: new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, camera.z, 1
    ]),
    InverseProjectionMatrix: new Float32Array(16),
    unity_ObjectToClipPos: new Float32Array([
        1, 0, 0, 0, 
        0, 1, 0, 0, 
        0, 0, 1, 0, 
        0, 0, 0, 1
    ]),
    
    FisheyeFOV: 60.0,
    
    start_index: 0,
  
    ScreenParams: new Float32Array(4),
    positions_tex_TexelSize: new Float32Array(2),
    adjacency_tex_TexelSize: new Float32Array(2),
};

const TEXTURE_UNITS = {
    MainTex: 0,
    attr_tex: 1,
    positions_tex: 2,
    adjacency_diff_tex: 3,
    adjacency_tex: 4,
};
var textureHandles = {}; // WebGL Texture objects

async function parsePLY()
{
    console.log("Begin parse PLY file");

    const result = await load(filePath, PLYLoader);
    console.log(result);
    console.log("End parse PLY file");
    // result.attributes.POSITION.value = result.attributes.POSITION.value.slice(0, 50000);
    plyData = result;
    adjData = (await loadAdjacencyBinary(filePath))
    // adjData = (await loadAdjacencyBinary(filePath)).slice(0, 1000000);
}

// loaders.gl does not support custom properties in PLY, so we manually extract adjacency indices from the binary file :(
async function loadAdjacencyBinary(filePath) {
    const response = await fetch(filePath);
    
    if (!response.ok) {
        throw new Error(`Failed to fetch PLY file: ${response.statusText}`);
    }

    // Get the raw binary data
    const rawBuffer = await response.arrayBuffer();
    
    // Extract Adjacency Indices
    const adjBlockStart = 1968522 * 203 + plyData.loaderData.headerLength;
    
    const adjBufferSlice = rawBuffer.slice(
        adjBlockStart, 
        adjBlockStart + (30268338 * 4)
    );
    
    const finalAdjacencyIndices = new Uint32Array(adjBufferSlice);
    console.log(finalAdjacencyIndices);
    
    return finalAdjacencyIndices;
}

function initWebGL()
{
    const canvas = document.getElementById("gl-canvas");

    // Need WebGL2 for GLSL version
    gl = canvas.getContext("webgl2");
    if (gl === null) {
        alert("Unable to initialize WebGL2.");
        return;
    }

    gl.clearColor(0.6, 0.3, 0.3, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const w = gl.canvas.width;
    const h = gl.canvas.height;
    SHADER_UNIFORMS.ScreenParams.set([1.0 / w, 1.0 / h, w, h]);
    
    const BUF_W = 4096.0;
    console.log(Math.ceil(adjData.length / BUF_W));
    console.log(Math.ceil((plyData.attributes.POSITION.value.length / 3) / BUF_W));

    SHADER_UNIFORMS.positions_tex_TexelSize.set([1.0 / BUF_W, 1.0 / BUF_W]);
    SHADER_UNIFORMS.adjacency_tex_TexelSize.set([1.0 / BUF_W, 1.0 / BUF_W]);

    // PROBLEM: Setting the texel size to the appropriate height, as commented below, causes memory overflow issues in WebGL.
    // Some sort of texture tiling system or storage is needed to fix.
    // SHADER_UNIFORMS.positions_tex_TexelSize.set([1.0 / BUF_W, Math.ceil((plyData.attributes.POSITION.value.length / 3) / BUF_W)]);
    // SHADER_UNIFORMS.adjacency_tex_TexelSize.set([1.0 / BUF_W, Math.ceil(adjData.length / BUF_W)]);
}

// Bind frag/vert shaders in index.html to webgl program and set uniforms
function initShaders()
{
    program = webglUtils.createProgramFromScripts(
        gl, ["shader-vs","shader-fs"]
    );
    gl.useProgram(program);
    console.log(gl.getParameter(gl.COMPRESSED_TEXTURE_FORMATS));
    console.log(gl.getParameter(gl.MAX_TEXTURE_SIZE));
    // Get all shader uniform locations
    uniformLocations.unity_ObjectToClipPos = gl.getUniformLocation(program, 'unity_ObjectToClipPos');
    uniformLocations.Camera2WorldMatrix = gl.getUniformLocation(program, '_Camera2WorldMatrix');

    uniformLocations.FisheyeFOV = gl.getUniformLocation(program, '_FisheyeFOV');
    uniformLocations.start_index = gl.getUniformLocation(program, '_start_index');
    uniformLocations.ScreenParams = gl.getUniformLocation(program, 'u_ScreenParams'); // used in vert
    uniformLocations.positions_tex_TexelSize = gl.getUniformLocation(program, '_positions_tex_TexelSize');
    uniformLocations.adjacency_tex_TexelSize = gl.getUniformLocation(program, '_adjacency_tex_TexelSize');

    uniformLocations.MainTex = gl.getUniformLocation(program, '_MainTex');
    uniformLocations.attr_tex = gl.getUniformLocation(program, '_attr_tex');
    uniformLocations.positions_tex = gl.getUniformLocation(program, '_positions_tex');
    uniformLocations.adjacency_diff_tex = gl.getUniformLocation(program, '_adjacency_diff_tex');
    uniformLocations.adjacency_tex = gl.getUniformLocation(program, '_adjacency_tex');

    console.log("Shaders init done");
}

function initScene()
{
    // full-screen quad
    const quadVertices = new Float32Array([
        -1.0, -1.0, 0.0,
         1.0, -1.0, 0.0,
        -1.0,  1.0, 0.0,
        -1.0,  1.0, 0.0,
         1.0, -1.0, 0.0,
         1.0,  1.0, 0.0
    ]);
    quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    // UVs range [0, 1] across quad
    const quadUVs = new Float32Array([
        0.0, 0.0, 
        1.0, 0.0, 
        0.0, 1.0, 
        0.0, 1.0, 
        1.0, 0.0, 
        1.0, 1.0
    ]);
    uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadUVs, gl.STATIC_DRAW);
    
    gl.getExtension('EXT_color_buffer_float');
    
    // Textures made from PLY data needed by shaders
    textureHandles = createVolumeTextures(gl, plyData, adjData);
  
}

function findClosestPointIndex(x, y, z, positions)
{
  var closestIndex = 0;
  var minDist = Infinity;
  for (let i = 0; i < positions.length / 3; i++) {
    var d = dist3(x, y, z, positions[i * 3 + 0], positions[i * 3 + 1], positions[i * 3 + 2]);
    if (d < minDist) {
      minDist = d;
      closestIndex = i;
    }
  }
  return closestIndex;
}

function setAttributes()
{
    // Position Attributes
    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

    // UV Attributes
    const uvLocation = gl.getAttribLocation(program, "a_uv");
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
}

function setUniforms(gl, program)
{
    // gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    gl.uniform1i(uniformLocations.MainTex, TEXTURE_UNITS.MainTex);
    gl.uniform1i(uniformLocations.attr_tex, TEXTURE_UNITS.attr_tex);
    gl.uniform1i(uniformLocations.positions_tex, TEXTURE_UNITS.positions_tex);
    gl.uniform1i(uniformLocations.adjacency_diff_tex, TEXTURE_UNITS.adjacency_diff_tex);
    gl.uniform1i(uniformLocations.adjacency_tex, TEXTURE_UNITS.adjacency_tex);

    gl.uniformMatrix4fv(uniformLocations.unity_ObjectToClipPos, false, SHADER_UNIFORMS.unity_ObjectToClipPos);
    gl.uniformMatrix4fv(uniformLocations.Camera2WorldMatrix, false, SHADER_UNIFORMS.Camera2WorldMatrix);

    gl.uniform1f(uniformLocations.FisheyeFOV, SHADER_UNIFORMS.FisheyeFOV);
    // gl.uniform1ui(uniformLocations.start_index, SHADER_UNIFORMS.start_index);
    gl.uniform1ui(uniformLocations._start_index, findClosestPointIndex(0, 0, -50, plyData.attributes.POSITION.value));
    gl.uniform4fv(uniformLocations.ScreenParams, SHADER_UNIFORMS.ScreenParams);
    gl.uniform2fv(uniformLocations.positions_tex_TexelSize, SHADER_UNIFORMS.positions_tex_TexelSize);
    gl.uniform2fv(uniformLocations.adjacency_tex_TexelSize, SHADER_UNIFORMS.adjacency_tex_TexelSize);
    
    // Bind Textures
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS.MainTex);
    gl.bindTexture(gl.TEXTURE_2D, textureHandles.MainTex || null); 

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS.positions_tex);
    gl.bindTexture(gl.TEXTURE_2D, textureHandles.positions_tex || null); 

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS.attr_tex);
    gl.bindTexture(gl.TEXTURE_2D, textureHandles.attr_tex || null);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS.adjacency_diff_tex);
    gl.bindTexture(gl.TEXTURE_2D, textureHandles.adjacency_diff_tex || null);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS.adjacency_tex);
    gl.bindTexture(gl.TEXTURE_2D, textureHandles.adjacency_tex || null);
}

function drawScene() {
    // Setup viewport
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);

    gl.useProgram(program);
    
    // Setup shaders
    setAttributes(); 
    setUniforms(gl, program); 

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, quadDrawCount);
    requestAnimationFrame(drawScene);
}

function main()
{
    parsePLY().then(() => {
        document.getElementById("loading-msg").hidden = true;
        initWebGL();
        initShaders();
        initScene();
        drawScene();
    });
}

main();