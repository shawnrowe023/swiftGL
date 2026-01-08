//
// SwiftGL
//
const SWIFTGL_VERSION = 1.2;

//
// GL constants
//

const defaultParameterValues = {
  filter: 'LINEAR',
}

//
// GL functions
//

// Returns true if the browser supports WebGL, false if it does not.
function isWebGLSupported() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    return gl instanceof WebGLRenderingContext;
  } catch (e) {
    return false;
  }
}

// Sets the buffer source of a ShaderSource object.
function ShaderSource(shaderSource) {
  this.shaderSource = shaderSource;
}

// Creates a shaderDisplay object from a Canvas DOMElement, an array of ScreenSizes, an array of Declaration objects, a string of globally-shared commons, and ShaderObject information.
function ShaderDisplay(canvas, screenSizes, declarations, commons, vertexShader, fragmentShadersList, textures, definitions, specifications) {
  this.canvas = canvas;
  this.gl = canvas.getContext('webgl');
  this.screenSizeXFlat = screenSizes.flat[0];
  this.screenSizeYFlat = screenSizes.flat[1];
  this.screenSizeX = screenSizes.scaled[0];
  this.screenSizeY = screenSizes.scaled[1];
  this.vertexShader = new ShaderSource(vertexShader);
  this.fragmentShaders = [];
  this.textures = textures;
  this.specifications = {
    buffers: [],
    textures: []
  };

  /* Create clean fragmentShadersList */
  
  var shaderCount = 0;
  const fragmentShadersListClean = [];

  for (let shaderInd = 0; shaderInd < fragmentShadersList.length; shaderInd++) {
    const shader = fragmentShadersList[shaderInd];

    if (shader != null) {
      fragmentShadersListClean[shaderCount] = shader;
    }

    shaderCount++;
  }

  const specBuffers = this.specifications.buffers;
  const specTextures = this.specifications.textures;

  // Add buffer uniforms to declarations
  for (let bufferInd = 0; bufferInd < fragmentShadersListClean.length - 1; bufferInd++) {
    declarations += 'uniform sampler2D iBuffer' + bufferInd + ';\n';
  }

  // Add texture uniforms to declarations
  for (let textureInd = 0; textureInd < textures.length; textureInd++) {
    declarations += 'uniform sampler2D iTexture' + textureInd + ';\n';
  }

  // Add definitions to declarations
  for (let definitionInd = 0; definitionInd < definitions.length; definitionInd++) {
    const def = definitions[definitionInd];
    declarations += '#define ' + def.defName + ' ' + def.value + '\n';
  }

  // Add commons to declarations
  declarations += commons;

  // Record number of lines in declarations to get accurate line numbers
  this.extraLines = declarations.split('\n').length - 1;

  // Add declarations to each shader source
  for (let shaderInd = 0; shaderInd < fragmentShadersListClean.length; shaderInd++) {
    this.fragmentShaders[shaderInd] = new ShaderSource(declarations + fragmentShadersListClean[shaderInd]);
  }

  // Process specifications
  for (let specInd = 0; specInd < specifications.length; specInd++) {
    const spec = specifications[specInd];
    const meta = spec && spec.meta;
    let specLoc;

    if (meta && 'id' in meta) {
      if (spec.type == 'Buffer') {
        specLoc = specBuffers;
      }
      else if (spec.type == 'Texture') {
        specLoc = specTextures;
      }
      else {
        continue;
      }

      // Copy default parameter values into meta if not present
      specLoc[meta.id] = Object.fromEntries(
        Object.keys(defaultParameterValues).map(key => [
          key,
          meta[key] ?? defaultParameterValues[key]
        ])
      );
    }
  }
}

// Creates and binds a new VertexBuffer object from a ShaderDisplay object.
function VertexBuffer(shaderDisplay) {
  const gl = shaderDisplay.gl;

  // Vertex data (Rectangle)
  this.vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  this.buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);
}

// Creates a new FragmentBuffer object from a ShaderDisplay object and unique Buffer ID.
function FragmentBuffer(shaderDisplay, bufferID) {
  const frameBuffer = createFrameBuffer(shaderDisplay, bufferID);
  this.buffer = frameBuffer.frameBuffer;
  this.texture = frameBuffer.texture;
}

// Creates a new VertexShader object from a ShaderDisplay object and binds it to a unique name.
function VertexShader(shaderDisplay, vertexShaderName) {
  const gl = shaderDisplay.gl;
  const [success, shader] = createShader(gl, gl.VERTEX_SHADER, shaderDisplay[vertexShaderName].shaderSource);
  this.shader = shader;
}

// Creates a new FragmentShader object from a ShaderDisplay object and VertexShader object.
function FragmentShader(shaderDisplay, vertexShader, shaderIndex) {
  const gl = shaderDisplay.gl;
  const fragmentShaders = shaderDisplay.fragmentShaders;
  const fragmentShader = fragmentShaders[shaderIndex];

  const [success, shader] = createShader(gl, gl.FRAGMENT_SHADER, fragmentShader.shaderSource, shaderDisplay.extraLines);

  if (!success) {
    return [false, shader];
  }

  this.shader = shader;
  this.program = createProgram(gl, vertexShader.shader, this.shader, shaderDisplay.extraLines);

  // hardcoded uniforms
  this.aPosition = gl.getAttribLocation(this.program, 'aPosition');
  this.iResolution = gl.getUniformLocation(this.program, 'iResolution');
  this.iTime = gl.getUniformLocation(this.program, 'iTime');
  this.iFrame = gl.getUniformLocation(this.program, 'iFrame');

  this.buffers = [];
  this.textures = [];

  for (let bufferInd = 0; bufferInd < shaderIndex; bufferInd++) {
    this.buffers[bufferInd] = gl.getUniformLocation(this.program, 'iBuffer' + bufferInd);
  }

  for (let textureInd = 0; textureInd < shaderDisplay.textures.length; textureInd++) {
    this.textures[textureInd] = gl.getUniformLocation(this.program, 'iTexture' + textureInd);
  }

  return [true, this];
}

// Creates a new FrameBuffer object from a buffer source and image source.
function FrameBuffer(frameBuffer, texture) {
  this.frameBuffer = frameBuffer;
  this.texture = texture;
}

// Creates a new ShaderLoader object from a VertexBuffer object, an array of buffers, shaders, and loaded images.
function ShaderLoader(vertexBuffer, buffers, shaders, textures) {
  this.vertexBuffer = vertexBuffer;
  this.buffers = buffers;
  this.shaders = shaders;
  this.textures = textures;
}

// Creates a new Define object with a name and assigned definition value.
function Define(defName, value) {
  this.defName = defName;
  this.value = value;
}

// Creates a new Spec object with a defined type and meta information for debugging.
function Spec(type, meta) {
  this.type = type;
  this.meta = meta;
}

// Processes a WebGL error that was thrown with correct line information.
function processGLError(errorMessage, extraLines) {
  // Rewrite error information to provide correct line numbers
  return errorMessage.replace(/(\d+):(\d+)/g, (match, line, col) => {
    return line + ':' + (parseInt(col, 10) - extraLines);
  });
}

// Creates a Shader object from a GL source, GL type, buffer source code, and extra line spacing for error messages.
function createShader(gl, type, source, extraLines) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const errorMessage = processGLError(gl.getShaderInfoLog(shader), extraLines);

    console.error('Error compiling shader:', errorMessage);
    gl.deleteShader(shader);

    return [false, errorMessage];
  }

  return [true, shader];
}

// Creates a Program object from a GL source, VertexShader object, FragmentShader object, and extra line spacing for error messages.
function createProgram(gl, vertexShader, fragmentShader, extraLines) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const errorMessage = processGLError(gl.getProgramInfoLog(program), extraLines);

    console.error('Error linking program:', errorMessage);
    gl.deleteProgram(program);

    return null;
  }

  return program;
}

// Assigns specification parameter information to a GL source.
function loadParameters(gl, spec) {
  spec = spec || defaultParameterValues;

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl[spec.filter]);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl[spec.filter]);
}

// Creates a FrameBuffer object from a ShaderDisplay source and unique Buffer ID.
function createFrameBuffer(shaderDisplay, bufferID) {
  const gl = shaderDisplay.gl;
  const spec = shaderDisplay.specifications.buffers[bufferID];
  const frameBuffer = gl.createFramebuffer();
  const texture = gl.createTexture();

  // Set up texture
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, shaderDisplay.screenSizeX, shaderDisplay.screenSizeY, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  loadParameters(gl, spec);
  gl.generateMipmap(gl.TEXTURE_2D);

  // Attach texture to frameBuffer
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  // Check frameBuffer completeness
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('Framebuffer not complete');
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return new FrameBuffer(frameBuffer, texture);
}

// Creates a new Texture object from a ShaderDisplay object with a unique texture ID.
function createTexture(shaderDisplay, textureID) {
  const gl = shaderDisplay.gl;
  const textures = shaderDisplay.textures;
  const spec = shaderDisplay.specifications.textures[textureID];
  const texture = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textures[textureID]);
  loadParameters(gl, spec);
  gl.generateMipmap(gl.TEXTURE_2D);

  return texture;
}

// Initializes and stages a ready WebGL buffer from a finalized shaderDisplay object.
function loadShaders(shaderDisplay) {
  const fragmentShaders = shaderDisplay.fragmentShaders;

  const vertexBuffer = new VertexBuffer(shaderDisplay);
  const vertexShader = new VertexShader(shaderDisplay, 'vertexShader');

  const buffers = [];
  const shaders = [];
  const textures = [];

  // Create buffers
  for (let bufferInd = 0; bufferInd < fragmentShaders.length - 1; bufferInd++) {
    buffers[bufferInd] = new FragmentBuffer(shaderDisplay, bufferInd);
  }

  // Create shaders
  for (let shaderInd = 0; shaderInd < fragmentShaders.length; shaderInd++) {
    const [success, shader] = new FragmentShader(shaderDisplay, vertexShader, shaderInd);

    /* Shader error */
    if (!success) {
      return [false, [shaderInd, shader]];
    }

    shaders[shaderInd] = shader;
  }

  // Create textures
  for (let textureInd = 0; textureInd < shaderDisplay.textures.length; textureInd++) {
    textures[textureInd] = createTexture(shaderDisplay, textureInd);
  }

  return [true, new ShaderLoader(vertexBuffer, buffers, shaders, textures)];
}

// Performs the render phase of a shader object.
function renderStep(shaderArgs) {
  const shaderDisplay = shaderArgs.shaderDisplay
  const shaderLoader = shaderArgs.shaderCompiled;
  const gl = shaderDisplay.gl;
  const canvas = shaderDisplay.canvas;
  const screenSizeX = shaderDisplay.screenSizeX;
  const screenSizeY = shaderDisplay.screenSizeY;
  const screenSizeXFlat = shaderDisplay.screenSizeXFlat;
  const screenSizeYFlat = shaderDisplay.screenSizeYFlat;

  const buffers = shaderLoader.buffers;
  const shaders = shaderLoader.shaders;
  const textures = shaderLoader.textures;
  const vertexBuffer = shaderLoader.vertexBuffer;

  for (let shaderInd = 0; shaderInd < shaders.length; shaderInd++) {
    const currentShader = shaders[shaderInd];
    const shaderBuffers = currentShader.buffers;
    const shaderTextures = currentShader.textures;

    // Render to current buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, shaderInd < shaders.length - 1 ? buffers[shaderInd].buffer : null);
    gl.viewport(0, 0, screenSizeX, screenSizeY);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(currentShader.program);

    // Set uniforms for current buffer
    if (shaderInd == 0) {
      gl.uniform3f(currentShader.iResolution, screenSizeXFlat, screenSizeYFlat, 1.0);
    }
    else {
      gl.uniform3f(currentShader.iResolution, screenSizeX, screenSizeY, 1.0);
    }
    gl.uniform1f(currentShader.iTime, shaderArgs.iTime);
    gl.uniform1i(currentShader.iFrame, shaderArgs.iFrame);

    // Bind buffers
    for (let bufferInd = 0; bufferInd < shaderBuffers.length; bufferInd++) {
      const buffId = bufferInd;

      gl.activeTexture(gl.TEXTURE0 + buffId);
      gl.bindTexture(gl.TEXTURE_2D, buffers[bufferInd].texture);
      gl.uniform1i(shaderBuffers[bufferInd], buffId);
    }

    // Bind textures
    for (let textureInd = 0; textureInd < shaderTextures.length; textureInd++) {
      const texId = textureInd + shaderBuffers.length + shaderInd;

      gl.activeTexture(gl.TEXTURE0 + texId);
      gl.bindTexture(gl.TEXTURE_2D, textures[textureInd]);
      gl.uniform1i(shaderTextures[textureInd], texId);
    }

    // Set up vertex attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer.buffer);
    gl.enableVertexAttribArray(currentShader.aPosition);
    gl.vertexAttribPointer(currentShader.aPosition, 2, gl.FLOAT, false, 0, 0);

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

/* Render wrapper */

// Renders a single, or multiple, frames with a callback function for extra render handling.
function renderFrame(loadCallback, isOnePass) {
  return ((timestamp) => {
    return render(loadCallback, isOnePass);
  });
}

// Initiates the rendering process with a render callback function for extra render handling.
function render(loadCallback, isOnePass) {
  const shaderLoaded = loadCallback(isOnePass);

  if (!shaderLoaded) {
    if (isOnePass) {
      return;
    }
    else {
      return requestAnimationFrame(renderFrame(loadCallback, isOnePass));
    }
  }

  renderStep(shaderLoaded);

  if (!isOnePass) {
    return requestAnimationFrame(renderFrame(loadCallback, isOnePass));
  }
}
