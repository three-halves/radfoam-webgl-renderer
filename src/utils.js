export function dist3(x1, y1, z1, x2, y2, z2)
{
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2);
}

export function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

export function multiply4x4(out, M1, M2) {
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            out[i * 4 + j] = 
                M1[i * 4 + 0] * M2[0 * 4 + j] +
                M1[i * 4 + 1] * M2[1 * 4 + j] +
                M1[i * 4 + 2] * M2[2 * 4 + j] +
                M1[i * 4 + 3] * M2[3 * 4 + j];
        }
    }
}

// Returns a 4x4 matrix for rotation around X-axis (Pitch)
export function rotationX(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Float32Array([
        1, 0, 0, 0,
        0, c, s, 0,
        0, -s, c, 0,
        0, 0, 0, 1
    ]);
}

// Returns a 4x4 matrix for rotation around Y-axis (Yaw)
export function rotationY(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Float32Array([
        c, 0, -s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        0, 0, 0, 1
    ]);
}

// Returns a 4x4 matrix for translation
export function translation(x, y, z) {
    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        x, y, z, 1
    ]);
}

export function rotationZ(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Float32Array([
        c, s, 0, 0,
        -s, c, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
}