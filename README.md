# radfoam-webgl-renderer
radfoam-webgl-render is an attempt to implement Radiant Foam rendering in WebGL. 
It is currently incomplete and contains a bug that prevents rendering. 
This implementation is based on the [original radfoam render](https://github.com/theialab/radfoam) and the existing [unity implementation](https://github.com/ChristianSchott/radfoam-unity).

## Setup
**Running this project requires installation of [Node.js and npm](https://github.com/theialab/radfoam).**

After cloning this repository, you will need to provide it with a pre-trained radfoam PLY file (which can be found on the original radfoam repository). To do this, create a directory in the project root named `data` and place the file within it.

After providing the PLY file, open a terminal in the project directory and run `npm run start`.
This will install all required packages and locally host the project using http-server. Navigate to the URL output by http-server (usually `127.0.0.1:8080`) using a chromium web browser.

## Notes and Issues
- It is highly recommended to use the "bonsai" pre-trained file for testing as it is one of the smallest pre-trained scenes, meaning it is relatively lightweight and fast to load.
- Initially parsing the PLY file after opening the page can take a while! The browser likely isn't frozen, but you can verify this by checking if any errors have been printed in the developer console.