# swiftGL
A fast, painless wrapper for rendering WebGL graphics

# Example
```javascript
// Resolution variables
const xRes = 1920;
const yRes = 1080;

// Vertex Source
const vertexSource = `
  attribute vec2 aPosition;
  varying vec2 vFragCoord;
  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    vFragCoord = (aPosition * 0.5 + 0.5) * vec2(${xRes.toFixed(1)}, ${yRes.toFixed(1)});
  }
`;

// Buffer Source
const bufferSource = `
  void main() {
    gl_FragColor = texture2D(iCurrentTexture, vFragCoord.xy / iResolution.xy);
  }
`;

// Declarations
const declares = `
  precision mediump float;
  varying vec2 vFragCoord;
  uniform vec3 iResolution;
`;

// Specifications
const specs = [
  new Spec('Texture', {id: 0, filter: 'LINEAR'}),
];

// Definitions
const defines = [
  new Define('iCurrentTexture', 'iTexture0'),
];

// Create shaders
const shaderDisplay = new ShaderDisplay(
  canvas, // render target
  xRes, // x resolution
  yRes, // y resolution
  declares, // declarations
  '', // commons (globally-shared functions and variables)
  vertexSource, // vertex shader
  [ bufferSource ], // shader passes
  images, // loaded images
  defines, // bootstrapped definitions
  specs // specifications
);

// Load shaders
const shaderLoader = loadShaders(shaderDisplay);

// Render shaders
render(shaderDisplay, shaderLoader);
```
