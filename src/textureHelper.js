function formatPLYData(plyData, adjData) 
{
    // Attributes provided by the PLY data structure
    const vertexCount = plyData.attributes.adjacency_offset.value.length;
    const srcPositions = plyData.attributes.POSITION.value;
    const adjOffsets = plyData.attributes.adjacency_offset.value;
    const adjIndices = adjData;
    const srcColors = plyData.attributes.COLOR_0.value;
    const srcDensity = plyData.attributes.density.value;

    var cellPositions = new ArrayBuffer(vertexCount * 4 * 4);
    var cellPositionsF32 = new Float32Array(cellPositions); 
    var cellPositionsU32 = new Uint32Array(cellPositions); 
    var cellAttributes = new Float32Array(vertexCount * 4); 
    
    var adjacencyDiffs = [];
    
    // Fill Cell Data and Calculate Adjacency Diffs

    for (var i = 0; i < vertexCount; i += 1) {
        // Current Cell Position
        const Pix = srcPositions[i * 3 + 0];
        const Piy = srcPositions[i * 3 + 1];
        const Piz = srcPositions[i * 3 + 2];

        cellPositionsF32[i * 4 + 0] = Pix;
        cellPositionsF32[i * 4 + 1] = Piy;
        cellPositionsF32[i * 4 + 2] = Piz;
        // cellPositionsU32[i * 4 + 3] = 0;
        cellPositionsU32[i * 4 + 3] = adjOffsets[i]; 

        if (i < 5) {
            console.log(`Cell ${i}: Source Offset (Uint) = ${adjOffsets[i]}`);
            console.log(`Cell ${i}: Packed Float Value = ${cellPositionsF32[i * 4 + 3]}`);
            console.log(`Cell ${i}: Unpacked Uint Value = ${cellPositionsU32[i * 4 + 3]}`);
        }

        cellAttributes[i * 4 + 0] = srcColors[i * 3] / 255.0;
        cellAttributes[i * 4 + 1] = srcColors[i * 3 + 1] / 255.0;
        cellAttributes[i * 3 + 2] = srcColors[i * 3 + 2] / 255.0;
        cellAttributes[i * 4 + 3] = srcDensity[i];
        
        const adj_start = (i === 0) ? 0 : adjOffsets[i - 1];
        const adj_end = adjOffsets[i];

        for (let j = adj_start; j < adj_end; j++) {
            // Get the index of the neighbor cell (j)
            const neighbor_index = adjIndices[j];
            
            const Pjx = srcPositions[neighbor_index * 3 + 0];
            const Pjy = srcPositions[neighbor_index * 3 + 1];
            const Pjz = srcPositions[neighbor_index * 3 + 2];
            
            // Calculate the Difference Vector
            const diff_x = Pjx - Pix;
            const diff_y = Pjy - Piy;
            const diff_z = Pjz - Piz;
            
            adjacencyDiffs.push(diff_x, diff_y, diff_z);
        }
    }
    
    // adjacencyIndices must be a Float32Array for compatibility with R32F texture format
    const adjacencyIndicesFloat = new Float32Array(adjIndices.buffer);
    console.log(new Uint32Array(adjIndices));
    return {
        cellPositions: new Float32Array(cellPositionsF32.buffer),
        cellAttributes: cellAttributes,
        adjacencyIndices: adjacencyIndicesFloat,
        adjacencyDiffs: new Float32Array(adjacencyDiffs)
    };
}

export function createVolumeTextures(gl, plyData, adjData) {
    const textureHandles = {};
    
    // Pre-processed data structure (replace placeholders with actual data arrays)
    const { 
        cellPositions,    // float4: x, y, z, adj_end_index (packed)
        cellAttributes,   // float4: r, g, b, density (packed)
        adjacencyIndices, // uint: next_cell_index
        adjacencyDiffs    // float3: face_midpoint_normal_diff
    } = formatPLYData(plyData, adjData); 

    const BUFFER_WIDTH = 4096;
    // Derived Dimensions
    const pos_attr_count = cellPositions.length / 4;
    const adj_count = adjacencyIndices.length;
    
    const POS_ATTR_HEIGHT = Math.ceil(pos_attr_count / BUFFER_WIDTH);
    const ADJ_HEIGHT = Math.ceil(adj_count / BUFFER_WIDTH);


    gl.getExtension('EXT_color_buffer_float');

    // Texture Helper
    const createTexture = (data, width, height, internalFormat, format, type, channels) => {
        const requiredSize = width * height * channels;

        // Pad the array if the data is smaller than the texture container
        if (data.length < requiredSize) {
            console.warn(`Padding texture: Data length ${data.length} -> Required ${requiredSize}`);
            const padded = new Float32Array(requiredSize);
            padded.set(data);
            data = padded; 
        }

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);

        gl.texImage2D(
            gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, data
        );

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    };

    textureHandles.positions_tex = createTexture(
        cellPositions,
        BUFFER_WIDTH, POS_ATTR_HEIGHT, gl.RGBA32F, gl.RGBA, gl.FLOAT, 4
    );

    textureHandles.attr_tex = createTexture(
        cellAttributes,
        BUFFER_WIDTH, POS_ATTR_HEIGHT, gl.RGBA32F, gl.RGBA, gl.FLOAT, 4
    );

    textureHandles.adjacency_tex = createTexture(
        adjacencyIndices, // This should be a Float32Array where each float represents the UINT index
        BUFFER_WIDTH, ADJ_HEIGHT,
        gl.R32F, gl.RED, gl.FLOAT, 1
    );

    textureHandles.adjacency_diff_tex = createTexture(
        adjacencyDiffs,
        BUFFER_WIDTH, ADJ_HEIGHT,
        gl.RGB32F, gl.RGB, gl.FLOAT, 3
    );

    return textureHandles;
}