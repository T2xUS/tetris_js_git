/*
Progress:
- Loaded vertices only in once
- Implemented game over state when cube reaches the top and some bugs regarding that
- Added a lot of buttons for starting, pausing, resetting, and ending the game
- Added slider to customize grid size
- Added slider to choose starting level
- Made sure sliders can't be set during gameplay, and certain buttons are activated at certain time
- Implemented hard drops with space
- Implemented gravity so that block falls automatically, made sure this is deactivated when the game isn't active
- Each level has a different falling speed
- Level is proportional to score
- Display messages for game over, victory, game end, and block clears from singles to tetrises
- Fixed the freezing issues and lag by reloading buffer only for new Tetrominos
- Fixed the discontinuity with rotating the camera eye
- Added light source directly over the playing field
- Bug fix: Reset gravity clock every time you drop a piece

Future work:
- Lower grid opacity?
- Texturing
- Make cubes EXPLODE when cleared, making add a special animation for dropping cubes as well
*/

"use strict"

var canvas;
var gl;
var program;

var DEMO = false;

// -----------------------------
// Hash table for color vectors
// -----------------------------

var colorTable = {
    'cyan'      : vec4( 0.0, 1.0, 1.0, 1.0 ),
    'yellow'    : vec4( 1.0, 1.0, 0.0, 1.0 ),
    'magenta'   : vec4( 1.0, 0.0, 1.0, 1.0 ),
    'blue'      : vec4( 0.0, 0.0, 1.0, 1.0 ),
    'orange'    : vec4( 1.0, 0.5, 0.0, 1.0 ),
    'red'       : vec4( 1.0, 0.0, 0.0, 1.0 ),
    'green'     : vec4( 0.0, 1.0, 0.0, 1.0 ),
    'black'     : vec4( 0.0, 0.0, 0.0, 1.0 ),
    'white'     : vec4( 1.0, 1.0, 1.0, 1.0 ),
    //'gray'      : vec4( 0.0, 0.0, 0.0, 0.5 ),
    'gray'      : vec4( 0.5, 0.5, 0.5, 1.0 ),
    'purple'    : vec4( 0.5, 0.0, 0.5, 1.0 ),
    'olive'     : vec4( 0.0, 0.4, 0.0, 1.0 ),
    'pink'      : vec4( 1.0, 0.5, 0.6, 1.0 )
};

// --------------------------------
// Variables pertaining to vertices
// --------------------------------

// Number of vertices in cubie to draw in drawArray function
var NumVertices = 36;

// Absolute value of each coordinate of each vertex for template cubie
var vertexPos = 0.5;

// Length of side of one of the cubies
var sidelen = 2*vertexPos;

// Spacing between cubelets
var spacing = 1.1;

// Vertex array used for rendering
// 0-36 is cubie
// 36-60 is cubie outline
// 60-78 is grid square
var points = [];

// Color array
// 36-78 are a fixed color
// Only need to reload 36-60 every time you render
var colors = new Array(114);

// Store line colors in color array
for (var i = 36; i < 60; ++i) {
    colors[i] = colorTable['black'];    
}

// Store grid colors in color array
for (var i = 60; i < 78; ++i) {
    colors[i] = colorTable['white'];   
}

// Store locked cubie colors
for (var i = 78; i < 114; ++i) {
    colors[i] = colorTable['gray'];
}

// Normals array
var normals = [];

// --------------------------------
// Grid boundaries
// --------------------------------

// Default 5x14x5
var grid_Xp = 2;
var grid_Xn = -2;
var grid_Yp = 6;
var grid_Yn = -7;
var grid_Zp = 2;
var grid_Zn = -2;

// Small 4x11x4
/*
var grid_Xp = 1;
var grid_Xn = -2;
var grid_Yp = 5;
var grid_Yn = -5;
var grid_Zp = 1;
var grid_Zn = -2;
*/

// Large 6x17x6
/*
var grid_Xp = 2;
var grid_Xn = -3;
var grid_Yp = 8;
var grid_Yn = -8;
var grid_Zp = 2;
var grid_Zn = -3;
*/

// --------------------------------
// Lighting and Texturing
// --------------------------------

var lightPosition = vec4( 0.0, 10.0, 0.0, 0.0 );
var lightAmbient = vec4( 0.7, 0.7, 0.7, 1.0 );
var lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
var lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

var materialAmbient = vec4( 0.7, 0.7, 0.7, 1.0 );
var materialDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
var materialSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );
var materialShininess = 100.0;

// --------------------------------
// Variables pertaining to viewing
// --------------------------------

// Spherical coordinate angles for rotating the cube
var THETA = radians(45);
var PHI = radians(45);

// Incremental angles to add to THETA and PHI while rotating
var dTHETA = 0;
var dPHI = 0;

// Camera distance from object
var cameraRadius = 25.0;

// For zooming in and out
var cameraRadiusMin = 12.5;
var cameraRadiusMax = 50.0;

// For the lookAt function (model-view matrix)
var eye = vec3(cameraRadius*Math.sin(PHI)*Math.sin(THETA),
            cameraRadius*Math.cos(PHI),
            cameraRadius*Math.sin(PHI)*Math.cos(THETA));
var at = vec3(0.0, 0.0, 0.0); // point camera towards origin
var up = vec3(0.0, 1.0, 0.0); // positive y-axis

// For the perspective function (projection matrix)
var fovy = 45.0;
var aspect = 1.0;
var near = 0.3;
var far = 1000;

// --------------------------------
// Axis indicators
// --------------------------------

var xAxis = 0;
var yAxis = 1;
var zAxis = 2;

// --------------------------------
// Variables pertaining to actions
// --------------------------------

// Queue for applying an action to a piece
// A translation/rotation doesn't happen until the preceding actions in the queue occur
var actionQueue = [];

// Determines if current action is a translation or rotation
var currentAction = 'none';

// Tetromimo translation direction
var translationDir = 'none';

// Tetromimo rotation direction
var rotationDir = 'none';

// Rotation animation speed
var rotationSpeed = 30.0;

// Indicator to check if a cubie has rotated one turn (up to 90 degrees)
var rotationAngle = 0;

// -------------------------
// Transformation matrices
// -------------------------

// Globals for transformation matrices
var worldViewMatrix = mat4();
var projectionMatrix = mat4();
var modelViewMatrix = mat4();

// Locks the transformation matrices to pass to vertex shader
var worldViewMatrixLoc;
var projectionMatrixLoc;
var modelViewMatrixLoc;

// ---------------------------------
// Game logic
// ---------------------------------

// Game status flags
var isGameStarted = false;
var isGameOver = false;
var isGamePaused = false;

// Game score
var gameScore = 0;

// Starting game level, taken from the slider
var startingGameLevel = 1;

// Current game level in game, affects Tetromino fall interval
var gameLevel = 1;

// Possible fall intervals based on level
var fallIntervals = [
    2000, // placeholder
    2000, // 1
    1500, // 2
    1200, // 3
    1000, // 4
    800, // 5
    600, // 6
    400, // 7
    200, // 8
    100, // 9
    50 // 10
];

// Millieconds taken by Tetromino to fall 1 unit
var fallInterval = fallIntervals[0];

// Score increase needed to jump to next level
var levelJumpScore = 1000;

// Make sure you call the following functions after the DOM object is generated in window.onload
var updateScoreboard = function() {
    document.getElementById("scoreboard").innerHTML = "Score: " + gameScore.toString();
}

var updateGameLevel = function() {
    document.getElementById("levelDisplay").innerHTML = "Level: " + gameLevel.toString();
}

var displayGameMessage = function(message) {
    document.getElementById("gameMessage").innerHTML = message;
}

var resetGameMessage = function() {
    document.getElementById("gameMessage").innerHTML = '';
}

// ---------------------------------
// General purpose helper functions
// ---------------------------------

// Functions for rounding a matrix/vector
var roundMatrix = function(m) {
    for (var i = 0; i < m.length; i++) {
        for (var j = 0; j < m[0].length; j++) {
            m[i][j] = Math.round(m[i][j]);
        }
    }
    return m;
}

var roundVector = function(v) {
    for (var i = 0; i < v.length; i++) {
        v[i] = Math.round(v[i]);
    }
    return v;
}

// Check if 2 vectors (of the same length) are equal
var equalVector = function(v1, v2) {
    for (var i = 0; i < 3; ++i) {
        if (v1[i] != v2[i]) {
            return false;
        }
    }
    return true;
}

// --------------------------------------------------
// Functions to create cubie template (and outlines)
// --------------------------------------------------

// Function that generates a quad (face) of one cubelet
function quad(a, b, c, d, v)
{
    // Vertices of one cubelet (8 to choose from)
    var vertices = [
        vec4( -v, -v,  v, 1.0 ),
        vec4( -v,  v,  v, 1.0 ),
        vec4(  v,  v,  v, 1.0 ),
        vec4(  v, -v,  v, 1.0 ),
        vec4( -v, -v, -v, 1.0 ),
        vec4( -v,  v, -v, 1.0 ),
        vec4(  v,  v, -v, 1.0 ),
        vec4(  v, -v, -v, 1.0 )
    ];

    // Normals
    var t1 = subtract(vertices[b], vertices[a]);
    var t2 = subtract(vertices[c], vertices[b]);
    var normal = vec3(cross(t1, t2));

    // 6 vertices determine a face in a quad (2 triangles)
    var indices = [ a, b, c, a, c, d ];
    for ( var i = 0; i < indices.length; ++i ) {
        // Push the vertices into the vertex array
        points.push( vertices[indices[i]] );
        // Push the normals into the array
        normals.push(normal);
    }
}

// Function that generates two parallel sides of a face
function quadOutline(a, b, c, d, v)
{
    var vertices = [
        vec4( -v, -v,  v, 1.0 ),
        vec4( -v,  v,  v, 1.0 ),
        vec4(  v,  v,  v, 1.0 ),
        vec4(  v, -v,  v, 1.0 ),
        vec4( -v, -v, -v, 1.0 ),
        vec4( -v,  v, -v, 1.0 ),
        vec4(  v,  v, -v, 1.0 ),
        vec4(  v, -v, -v, 1.0 )
    ];

    var t1 = subtract(vertices[b], vertices[a]);
    var t2 = subtract(vertices[c], vertices[b]);
    var normal = vec3(cross(t1, t2));

    var indices = [ a, b, c, d ];
    for ( var i = 0; i < indices.length; ++i ) {
        points.push( vertices[indices[i]] );
        normals.push(normal);
    }
}

// Function that generates a cubie (and outlines) using quad
function cubelet(v)
{
    quad( 2, 3, 7, 6, v); // right face
    quad( 5, 4, 0, 1, v); // left face
    quad( 6, 5, 1, 2, v); // top face
    quad( 3, 0, 4, 7, v); // bottom face
    quad( 1, 0, 3, 2, v); // front face
    quad( 4, 5, 6, 7, v); // back face

    // right face
    quadOutline( 2, 3, 6, 7, v+0.01);
    quadOutline( 2, 6, 3, 7, v+0.01);
    // left face
    quadOutline( 5, 4, 1, 0, v+0.01);
    quadOutline( 5, 1, 4, 0, v+0.01);
    // top remainder
    quadOutline( 6, 5, 1, 2, v+0.01);
    // bottom remainder
    quadOutline( 3, 0, 4, 7, v+0.01);
}

// -------------------------------------------------
// Function to create grid unit (just a single quad)
// -------------------------------------------------

function GridQuad(a, b, c, d, v)
{
    var vertices = [
        vec4( -v, -v,  v, 1.0 ),
        vec4( -v,  v,  v, 1.0 ),
        vec4(  v,  v,  v, 1.0 ),
        vec4(  v, -v,  v, 1.0 ),
        vec4( -v, -v, -v, 1.0 ),
        vec4( -v,  v, -v, 1.0 ),
        vec4(  v,  v, -v, 1.0 ),
        vec4(  v, -v, -v, 1.0 )
    ];

    var t1 = subtract(vertices[b], vertices[a]);
    var t2 = subtract(vertices[c], vertices[b]);
    var normal = vec3(cross(t1, t2));

    var indices = [ a, b, c, a, c, d ];
    for ( var i = 0; i < indices.length; ++i ) {
        points.push( vertices[indices[i]] );
        normals.push(normal);
    }
}

// ---------------------------------------------
// Grid Square class, analogous to Cubie class
// ---------------------------------------------

function GridSquare(x, y, z) {

    // Places grid square where it should be in the grid
    this.placementMatrix = translate(x*spacing, y*spacing, z*spacing);

    /*
    // Grid color, white for now
    this.colors = [];
    for (var i = 0; i < 78; i++) {
        this.colors.push(colorTable['white']);   
    }
    */

    // World matrix is just the placement matrix, don't need to do anything else with grid
    this.getWorldMatrix = function() {
        return this.placementMatrix;
    }
}

// -------------------------
// Grid classes
// -------------------------

function GridBottom() {

    this.squares = [];

    this.clear = function() {
        this.squares = [];
    }

    this.init = function() {
        var y = grid_Yn;
        for ( var x = grid_Xn; x <= grid_Xp; x++) {
            for (var z = grid_Zn; z <= grid_Zp; z++) {
                var square = new GridSquare(x, y, z);
                this.squares.push(square);
            }
        }
    }
}

function GridLeftWall() {

    this.squares = [];

    this.clear = function() {
        this.squares = [];
    }

    this.init = function() {
        var x = grid_Xn;
        for ( var y = grid_Yn; y <= grid_Yp; y++) {
            for (var z = grid_Zn; z <= grid_Zp; z++) {
                var square = new GridSquare(x, y, z);
                this.squares.push(square);
            }
        }
    }
}

function GridBackWall() {

    this.squares = [];

    this.clear = function() {
        this.squares = [];
    }

    this.init = function() {
        var z = grid_Zn;
        for ( var x = grid_Xn; x <= grid_Xp; x++) {
            for (var y = grid_Yn; y <= grid_Yp; y++) {
                var square = new GridSquare(x, y, z);
                this.squares.push(square);
            }
        }
    }
}

var gridBottom = new GridBottom();
var gridLeftWall = new GridLeftWall();
var gridBackWall = new GridBackWall();

// -------------------------
// Cubie class
// -------------------------

function Cubie(x, y, z) {//, color) {

    // Starting position (after placement) before translations and rotations
    this.origPosition = vec4(x, y, z, 1.0);

    // Current position
    this.currPosition = vec4(x, y, z, 1.0);

    // Placement of the cube relative to others in the same Tetromino
    this.placementMatrix = translate(x*spacing, y*spacing, z*spacing);

    // Overall translation matrix due to moving sideways or downwards
    this.translationMatrix = mat4();

    // Translation matrix with spacing
    this.translationMatrixSpaced = mat4();

    // Previous rotation matrix before a new 90 rotation has been made
    this.prevRotationMatrix = mat4();

    // Overall rotation matrix due to rotating the piece
    this.rotationMatrix = mat4();

    // Current angle of rotation, initialized at 0
    this.theta = [0,0,0];

    // Cubie's colors based on Tetromino type
    /*
    this.colors = [];
    for (var i = 0; i < NumVertices; i++) {
        this.colors.push(colorTable[color]);    
    }
    */

    // Cubie's outline colors
    /*
    this.lineColors = [];
    for (var i = 0; i < 60; i++) {
        this.lineColors.push(colorTable['black']);    
    }
    */

    this.getWorldMatrix = function() {
        var worldMatrix = mat4();
        worldMatrix = mult(this.placementMatrix, worldMatrix);
        worldMatrix = mult(this.rotationMatrix, worldMatrix);
        worldMatrix = mult(this.translationMatrixSpaced, worldMatrix);        
        return worldMatrix;
    }
}

// -------------------------
// Class for locked cubies
// -------------------------

function Locked() {

    // Height of locked cubies
    // Initialize to the bottom of the grid
    this.height = grid_Yn-1;

    // Store cubies according to the row they are in
    // Need to add extra one because to consider what happens if the top row shifts down
    // (if top row shifts down, need to replace it with an empty array)
    this.cubies = [];

    this.colors = [];
    for (var i = 0; i < NumVertices; ++i) {
        this.colors.push(colorTable['gray']);   
    }

    // Initialize potential row for locked cubies based on grid size
    // Also initialize height again (in case the grid size changes)
    this.init = function() {
        this.height = grid_Yn-1;
        this.cubies = [];
        for (var i = 0; i < grid_Yp-grid_Yn+2; ++i) {
           this.cubies.push([]);
        }
    }

    // Push cubies onto locked cubies according to row
    this.push = function(cubie) {
        var rowNumber = cubie.currPosition[1]; // row # is y position
        // Need to shift index to start from 0
        this.cubies[rowNumber-grid_Yn].push(cubie);
        // If new height is reached, update it
        if (rowNumber > this.height) {
            this.height = rowNumber;
        }
    }

    // Checks if moving/rotating cubie causes a collision with the locked pieces
    this.isCollision = function(direction, cubie) {
        var bool = false;
        var nextPosition;

        // Most important collision, determines if a Tetromino should be locked or not

        if (direction == 'down') {
            // Get position from moving cubie down
            nextPosition = mult(translate(0,-1,0), cubie.currPosition);
        }

        // Other collisions due to translations

        else if (direction == 'left') {
            nextPosition = mult(translate(-1,0,0), cubie.currPosition);
        } else if (direction == 'right') {
            nextPosition = mult(translate(1,0,0), cubie.currPosition);
        } else if (direction == 'front') {
            nextPosition = mult(translate(0,0,1), cubie.currPosition);
        } else if (direction == 'back') {
            nextPosition = mult(translate(0,0,-1), cubie.currPosition);
        }

        // Collisions due to rotations
        // NOTE: This only checks if the position AFTER the rotation occurs collides with a locked piece
        // It doesn't check if it collides DURING the rotation.

        else if (direction == 'xCCW') {
            nextPosition = mult(cubie.prevRotationMatrix, cubie.origPosition);
            nextPosition = roundVector(mult(rotateX(90.0), nextPosition));
            nextPosition = mult(cubie.translationMatrix, nextPosition);
        } else if (direction == 'xCW') {
            nextPosition = mult(cubie.prevRotationMatrix, cubie.origPosition);
            nextPosition = roundVector(mult(rotateX(-90.0), nextPosition));
            nextPosition = mult(cubie.translationMatrix, nextPosition);
            
        } else if (direction == 'yCCW') {
            nextPosition = mult(cubie.prevRotationMatrix, cubie.origPosition);
            nextPosition = roundVector(mult(rotateY(90.0), nextPosition));
            nextPosition = mult(cubie.translationMatrix, nextPosition);
        } else if (direction == 'yCW') {
            nextPosition = mult(cubie.prevRotationMatrix, cubie.origPosition);
            nextPosition = roundVector(mult(rotateY(-90.0), nextPosition));
            nextPosition = mult(cubie.translationMatrix, nextPosition);
        } else if (direction == 'zCCW') {
            nextPosition = mult(cubie.prevRotationMatrix, cubie.origPosition);
            nextPosition = roundVector(mult(rotateZ(90.0), nextPosition));
            nextPosition = mult(cubie.translationMatrix, nextPosition);
        } else if (direction == 'zCW') {
            nextPosition = mult(cubie.prevRotationMatrix, cubie.origPosition);
            nextPosition = roundVector(mult(rotateZ(-90.0), nextPosition));
            nextPosition = mult(cubie.translationMatrix, nextPosition);
        }

        // Go through each locked cubie and check if it coincides with the new position
        this.cubies.forEach(function(lockedRow) {
            lockedRow.forEach(function(lockedCubie) {
                if (equalVector(nextPosition, lockedCubie.currPosition)) {
                    bool = true;
                    return;
                }
            });
        });

        return bool;
    }

    // Check if need to clear rows every time a row is locked
    this.clearRows = function() {

        // Keep track of how many lines are cleared at once to add to score accordingly
        var linesCleared = 0;

        // Check from bottom row to topmost row of cubies
        for (var row = grid_Yn; row <= this.height; ++row) {
            // Check if row is full
            if (this.cubies[row-grid_Yn].length == (grid_Xp-grid_Xn+1)*(grid_Zp-grid_Zn+1)) {
                linesCleared++;
                // If row is full, clear it by shifting down all rows above
                for (var row2 = row; row2 <= this.height; ++ row2) {
                    // Replace the rows in the cubie matrix
                    this.cubies[row2-grid_Yn] = this.cubies[row2-grid_Yn+1].slice();
                    // Translate the actual cubies downwards
                    this.cubies[row2-grid_Yn].forEach(function(lockedCubie) {
                        lockedCubie.translationMatrixSpaced = mult(translate(0,-1*spacing,0), lockedCubie.translationMatrixSpaced);
                        lockedCubie.translationMatrix = mult(translate(0,-1,0), lockedCubie.translationMatrix);
                        lockedCubie.currPosition = mult(translate(0,-1,0), lockedCubie.currPosition);
                    });
                }
                // Decrement height (loop end condition changes as well)
                this.height--;
                // Start from current row that just got shifted down
                row--;
            }
        }

        // Update score and scoreboard
        if (linesCleared) {
            gameScore += 1000*Math.pow(2,linesCleared-1);
        }
        updateScoreboard();

        // Check if level increased (after every score increase)
        var newGameLevel = Math.floor(gameScore / levelJumpScore) + 1;
        if (newGameLevel > gameLevel) {
            gameLevel = newGameLevel;
            updateGameLevel();
            // If you beat level 10, you win the game
            if (newGameLevel > 10) {
                currTetromino.stopFalling();
                displayGameMessage("You win!");
                isGameOver = true;
                isGameStarted = false;
                isGamePaused = false;
                document.getElementById('startButton').disabled = false;
                document.getElementById('pauseButton').disabled = true;
                document.getElementById('resetButton').disabled = true;
                document.getElementById('endButton').disabled = true;
                // Reenable sliders
                document.getElementById('gridSizeSlider').disabled = false;
                document.getElementById('levelSlider').disabled = false;
                // Reset level and speed
                gameLevel = startingGameLevel;
                fallInterval = fallIntervals[gameLevel];
                return;
            }
            // Otherwise update the fall interval and keep going
            fallInterval = fallIntervals[gameLevel];
        }

        // Display special message
        if (linesCleared == 1) {
            displayGameMessage("Single!");
        } else if (linesCleared == 2) {
            displayGameMessage("Double!");
        } else if (linesCleared == 3) {
            displayGameMessage("Triple!");
        } else if (linesCleared == 4) {
            displayGameMessage("Tetris!");
        }

        // Reset lines cleared
        linesCleared = 0;

        // Whenever a block is dropped / line is cleared, reset the clock
        currTetromino.stopFalling();
        currTetromino.startFalling(fallInterval);
    }

    // Check if game over after a new Tetromino is spawned
    this.gameOver = function() {
        var bool = false;
        // Only need to check this if game is danger of being over (if the height has reached the top 2 rows)
        // If height is at least 2nd to top row, check that row
        if (this.height >= grid_Yp-1) {
            this.cubies[grid_Yp-1-grid_Yn].forEach(function(lockedCubie) {
                currTetromino.cubies.forEach(function(cubie) {
                    if (equalVector(cubie.currPosition, lockedCubie.currPosition)) {
                        bool = true;
                        return;
                    }
                });
                if (bool) {
                    return;
                } 
            });
            // Next check the top row if height is actually the top row
            if (this.height >= grid_Yp) {
                this.cubies[grid_Yp-grid_Yn].forEach(function(lockedCubie) {
                    currTetromino.cubies.forEach(function(cubie) {
                        if (equalVector(cubie.currPosition, lockedCubie.currPosition)) {
                            bool = true;
                            return;
                        }
                    });
                    if (bool) {
                        return;
                    } 
                });
            }
        }
        return bool;
    }
}

var lockedCubies = new Locked();

// -------------------------
// Tetromino class
// -------------------------

function Tetromino() {

    this.cubies = [];

    // Clear current Tetromino
    this.clear = function() {
        this.cubies = [];
    }

    // Color for this Tetromino
    this.color = '';

    // Previous piece, initialized to nothing
    this.previousPiece = '';

    // Initialize Tetromino based on type
    this.init = function(type) {
        if (type == 'I') {
            this.color = 'cyan';
            this.cubies.push(new Cubie(-2,0,0));//,'cyan'));
            this.cubies.push(new Cubie(-1,0,0));//,'cyan'));
            this.cubies.push(new Cubie(-0,0,0));//,'cyan'));
            this.cubies.push(new Cubie(1,0,0));//,'cyan'));
        } else if (type == 'O') {
            this.color = 'yellow';
            this.cubies.push(new Cubie(-1,0,0));//,'yellow'));
            this.cubies.push(new Cubie(0,0,0));//,'yellow'));
            this.cubies.push(new Cubie(-1,-1,0));//,'yellow'));
            this.cubies.push(new Cubie(0,-1,0));//,'yellow'));
        } else if (type == 'T') {
            this.color = 'magenta';
            this.cubies.push(new Cubie(-1,0,0));//,'magenta'));
            this.cubies.push(new Cubie(0,0,0));//,'magenta'));
            this.cubies.push(new Cubie(1,0,0));//,'magenta'));
            this.cubies.push(new Cubie(0,-1,0));//,'magenta'));
        } else if (type == 'J') {
            this.color = 'blue';
            this.cubies.push(new Cubie(-1,0,0));//,'blue'));
            this.cubies.push(new Cubie(0,0,0));//,'blue'));
            this.cubies.push(new Cubie(1,0,0));//,'blue'));
            this.cubies.push(new Cubie(1,-1,0));//,'blue'));
        } else if (type == 'L') {
            this.color = 'orange';
            this.cubies.push(new Cubie(-1,0,0));//,'orange'));
            this.cubies.push(new Cubie(0,0,0));//,'orange'));
            this.cubies.push(new Cubie(1,0,0));//,'orange'));
            this.cubies.push(new Cubie(-1,-1,0));//,'orange'));
        } else if (type == 'S') {
            this.color = 'green';
            this.cubies.push(new Cubie(0,0,0));//,'green'));
            this.cubies.push(new Cubie(1,0,0));//,'green'));
            this.cubies.push(new Cubie(-1,-1,0));//,'green'));
            this.cubies.push(new Cubie(0,-1,0));//,'green'));
        } else if (type == 'Z') {
            this.color = 'red';
            this.cubies.push(new Cubie(-1,0,0));//,'red'));
            this.cubies.push(new Cubie(0,0,0));//,'red'));
            this.cubies.push(new Cubie(0,-1,0));//,'red'));
            this.cubies.push(new Cubie(1,-1,0));//,'red'));
        } else if (type == 'Tvar') {
            this.color = 'purple';
            this.cubies.push(new Cubie(0,0,0));//,'purple'));
            this.cubies.push(new Cubie(0,-1,0));//,'purple'));
            this.cubies.push(new Cubie(0,-1,1));//,'purple'));
            this.cubies.push(new Cubie(1,-1,0));//,'purple'));
        } else if (type == 'Svar') {
            this.color = 'olive';
            this.cubies.push(new Cubie(0,0,0));//,'olive'));
            this.cubies.push(new Cubie(1,0,0));//,'olive'));
            this.cubies.push(new Cubie(0,-1,1));//,'olive'));
            this.cubies.push(new Cubie(0,-1,0));//,'olive'));
        } else if (type == 'Zvar') {
            this.color = 'pink';
            this.cubies.push(new Cubie(-1,0,0));//,'pink'));
            this.cubies.push(new Cubie(0,0,0));//,'pink'));
            this.cubies.push(new Cubie(0,-1,0));//,'pink'));
            this.cubies.push(new Cubie(0,-1,1));//,'pink'));
        }
        // Place Tetromino at the top
        this.cubies.forEach(function(cubie) {
            cubie.translationMatrixSpaced = mult(translate(0,grid_Yp*spacing,0), cubie.translationMatrixSpaced);
            cubie.translationMatrix = mult(translate(0,grid_Yp,0), cubie.translationMatrix);
            cubie.currPosition = mult(translate(0,grid_Yp,0), cubie.currPosition);
        });
        // Bookmark the previous piece
        this.previousPiece = type;
    }

    // Check if translation will result in out of bounds condition
    this.canTranslate = function(direction) {
        var bool = true;
        if (direction == 'left') {
            this.cubies.forEach(function(cubie) {
                if (cubie.currPosition[xAxis] == grid_Xn || lockedCubies.isCollision('left',cubie)) {
                    // Careful, returning a value here doesn't return in the main function scope
                    bool = false;
                    return;
                }
            });
        } else if (direction == 'right') {
            this.cubies.forEach(function(cubie) {
                if (cubie.currPosition[xAxis] == grid_Xp || lockedCubies.isCollision('right',cubie)) {
                    bool = false;
                    return;
                }
            });
        }

        // Special case, need to lock piece in place if there is collision
        else if (direction == 'down') {
            this.cubies.forEach(function(cubie) {
                if (cubie.currPosition[yAxis] == grid_Yn || lockedCubies.isCollision('down',cubie)) {
                    bool = false;
                    return;
                }
            });
            // If collision here, lock the Tetrimino down
            if (!bool) {
                this.lock();
            }
        }

        else if (direction == 'front') {
            this.cubies.forEach(function(cubie) {
                if (cubie.currPosition[zAxis] == grid_Zp || lockedCubies.isCollision('front',cubie)) {
                    bool = false;
                    return;
                }
            });
        } else if (direction == 'back') {
            this.cubies.forEach(function(cubie) {
                if (cubie.currPosition[zAxis] == grid_Zn || lockedCubies.isCollision('back',cubie)) {
                    bool = false;
                    return;
                }
            });
        }
        return bool;
    }

    // Modify the translation matrix for the vertex shader and also change the currnet position
    this.translate = function(direction) {
        if (this.canTranslate(direction)) {
            this.cubies.forEach(function(cubie) {
                if (direction == 'left') {
                    // Remember to add spacing or it won't look right
                    cubie.translationMatrixSpaced = mult(translate(-1*spacing,0,0), cubie.translationMatrixSpaced);
                    cubie.translationMatrix = mult(translate(-1,0,0), cubie.translationMatrix);                    
                } else if (direction == 'right') {
                    cubie.translationMatrixSpaced = mult(translate(1*spacing,0,0), cubie.translationMatrixSpaced);
                    cubie.translationMatrix = mult(translate(1,0,0), cubie.translationMatrix);
                } else if (direction == 'down') {
                    cubie.translationMatrixSpaced = mult(translate(0,-1*spacing,0), cubie.translationMatrixSpaced);
                    cubie.translationMatrix = mult(translate(0,-1,0), cubie.translationMatrix);
                } else if (direction == 'front') {
                    cubie.translationMatrixSpaced = mult(translate(0,0,1*spacing), cubie.translationMatrixSpaced);
                    cubie.translationMatrix = mult(translate(0,0,1), cubie.translationMatrix);
                } else if (direction == 'back') {
                    cubie.translationMatrixSpaced = mult(translate(0,0,-1*spacing), cubie.translationMatrixSpaced);
                    cubie.translationMatrix = mult(translate(0,0,-1), cubie.translationMatrix);
                }
                // Update the current location
                cubie.currPosition = mult(cubie.rotationMatrix, cubie.origPosition);
                cubie.currPosition = mult(cubie.translationMatrix, cubie.currPosition);
            });
        }
    }

    // Hard drop the Tetromino
    this.drop = function() {
        // Keep track of how many units it can move down
        var unitsDown = 0;
        // Keep moving down until it can't anymore
        // Lock is inherent in canTranslate
        while (this.canTranslate('down')) {
            unitsDown++;
            this.cubies.forEach(function(cubie) {
                cubie.translationMatrixSpaced = mult(translate(0,-1*spacing,0), cubie.translationMatrixSpaced);
                cubie.translationMatrix = mult(translate(0,-1,0), cubie.translationMatrix);
                cubie.currPosition = mult(cubie.rotationMatrix, cubie.origPosition);
                cubie.currPosition = mult(cubie.translationMatrix, cubie.currPosition);
            });
        }
    }

    // Round the rotation matrix so it has only 0 and +/-1
    this.roundRotationMatrix = function() {
        this.cubies.forEach(function(cubie) {
            cubie.rotationMatrix = roundMatrix(cubie.rotationMatrix);
        });
    }

    // Round the position values after a rotation
    this.roundPosition = function() {
        this.cubies.forEach(function(cubie) {
            cubie.currPosition = roundVector(cubie.currPosition);
        });
    }

    // Check if rotation will result in out of bounds condition
    this.canRotate = function(direction) {
        var bool = true;
        var newPos;
        if (direction == 'xCCW') {
            this.cubies.forEach(function(cubie) {
                newPos = mult(cubie.prevRotationMatrix, cubie.origPosition);
                newPos = roundVector(mult(rotateX(90.0), newPos));
                newPos = mult(cubie.translationMatrix, newPos);
                if (newPos[xAxis] == grid_Xn-1 || newPos[xAxis] == grid_Xp+1 ||
                    newPos[yAxis] == grid_Yn-1 || newPos[yAxis] == grid_Yp+1 ||
                    newPos[zAxis] == grid_Zn-1 || newPos[zAxis] == grid_Zp+1 ||
                    lockedCubies.isCollision('xCCW',cubie)) {
                    bool = false;
                    return;
                }
            });
        } else if (direction == 'xCW') {
            this.cubies.forEach(function(cubie) {
                newPos = mult(cubie.prevRotationMatrix, cubie.origPosition);
                newPos = roundVector(mult(rotateX(-90.0), newPos));
                newPos = mult(cubie.translationMatrix, newPos);
                if (newPos[xAxis] == grid_Xn-1 || newPos[xAxis] == grid_Xp+1 ||
                    newPos[yAxis] == grid_Yn-1 || newPos[yAxis] == grid_Yp+1 ||
                    newPos[zAxis] == grid_Zn-1 || newPos[zAxis] == grid_Zp+1 ||
                    lockedCubies.isCollision('xCW',cubie)) {
                    bool = false;
                    return;
                }
            });
        } else if (direction == 'yCCW') {
            var i = 0;
            this.cubies.forEach(function(cubie) {
                newPos = mult(cubie.prevRotationMatrix, cubie.origPosition);
                newPos = roundVector(mult(rotateY(90.0), newPos));
                newPos = mult(cubie.translationMatrix, newPos);
                if (newPos[xAxis] == grid_Xn-1 || newPos[xAxis] == grid_Xp+1 ||
                    newPos[yAxis] == grid_Yn-1 || newPos[yAxis] == grid_Yp+1 ||
                    newPos[zAxis] == grid_Zn-1 || newPos[zAxis] == grid_Zp+1 ||
                    lockedCubies.isCollision('yCCW',cubie)) {
                    bool = false;
                    return;
                }
            });
        } else if (direction == 'yCW') {
            this.cubies.forEach(function(cubie) {
                newPos = mult(cubie.prevRotationMatrix, cubie.origPosition);
                newPos = roundVector(mult(rotateY(-90.0), newPos));
                newPos = mult(cubie.translationMatrix, newPos);
                if (newPos[xAxis] == grid_Xn-1 || newPos[xAxis] == grid_Xp+1 ||
                    newPos[yAxis] == grid_Yn-1 || newPos[yAxis] == grid_Yp+1 ||
                    newPos[zAxis] == grid_Zn-1 || newPos[zAxis] == grid_Zp+1 ||
                    lockedCubies.isCollision('yCW',cubie)) {
                    bool = false;
                    return;
                }
            });
        } else if (direction == 'zCCW') {
            this.cubies.forEach(function(cubie) {
                newPos = mult(cubie.prevRotationMatrix, cubie.origPosition);
                newPos = roundVector(mult(rotateZ(90.0), newPos));
                newPos = mult(cubie.translationMatrix, newPos);
                if (newPos[xAxis] == grid_Xn-1 || newPos[xAxis] == grid_Xp+1 ||
                    newPos[yAxis] == grid_Yn-1 || newPos[yAxis] == grid_Yp+1 ||
                    newPos[zAxis] == grid_Zn-1 || newPos[zAxis] == grid_Zp+1 ||
                    lockedCubies.isCollision('zCCW',cubie)) {
                    bool = false;
                    return;
                }
            });
        } else if (direction == 'zCW') {
            this.cubies.forEach(function(cubie) {
                newPos = mult(cubie.prevRotationMatrix, cubie.origPosition);
                newPos = roundVector(mult(rotateZ(-90.0), newPos));
                newPos = mult(cubie.translationMatrix, newPos);
                if (newPos[xAxis] == grid_Xn-1 || newPos[xAxis] == grid_Xp+1 ||
                    newPos[yAxis] == grid_Yn-1 || newPos[yAxis] == grid_Yp+1 ||
                    newPos[zAxis] == grid_Zn-1 || newPos[zAxis] == grid_Zp+1 ||
                    lockedCubies.isCollision('zCW',cubie)) {
                    bool = false;
                    return;
                }
            });
        }  
        return bool;
    }

    // Modify the rotation matrix for the vertex shader, don't change current position
    this.rotate = function(direction) {
        if (this.canRotate(direction)) {
            this.cubies.forEach(function(cubie) {
                if (direction == 'xCCW') {
                    cubie.theta[xAxis] += rotationSpeed;
                    cubie.rotationMatrix = mult(rotateX(cubie.theta[xAxis]), cubie.prevRotationMatrix);
                } else if (direction == 'xCW') {
                    cubie.theta[xAxis] += rotationSpeed;
                    cubie.rotationMatrix = mult(rotateX(-cubie.theta[xAxis]), cubie.prevRotationMatrix);
                } else if (direction == 'yCCW') {
                    cubie.theta[yAxis] += rotationSpeed;
                    cubie.rotationMatrix = mult(rotateY(cubie.theta[yAxis]), cubie.prevRotationMatrix);
                } else if (direction == 'yCW') {
                    cubie.theta[yAxis] += rotationSpeed;
                    cubie.rotationMatrix = mult(rotateY(-cubie.theta[yAxis]), cubie.prevRotationMatrix);
                } else if (direction == 'zCCW') {
                    cubie.theta[zAxis] += rotationSpeed;
                    cubie.rotationMatrix = mult(rotateZ(cubie.theta[zAxis]), cubie.prevRotationMatrix);
                } else if (direction == 'zCW') {
                    cubie.theta[zAxis] += rotationSpeed;
                    cubie.rotationMatrix = mult(rotateZ(-cubie.theta[zAxis]), cubie.prevRotationMatrix);
                }
            });
        }
    }

    // Change the current position due to rotation (only after a full turn)
    this.updateRotationLocation = function() {
        // Round the rotation matrix so it has only 0 and +/-1
        this.roundRotationMatrix();
        this.cubies.forEach(function(cubie) {  
            // Update the current location applying the transformations to the original location
            cubie.currPosition = mult(cubie.rotationMatrix, cubie.origPosition);
            cubie.currPosition = mult(cubie.translationMatrix, cubie.currPosition);
            // Set the previous rotation matrix to the current one to prepare for next rotation
            cubie.prevRotationMatrix = cubie.rotationMatrix;
            // Reset the cubie theta
            cubie.theta = [0,0,0];
        });
        // Round the position after updating them, just in case
        this.roundPosition();
    }

    // Lock Tetrimino in place
    this.lock = function() {
        // Add to locked cubes
        this.cubies.forEach(function(cubie) {
            var x = cubie.currPosition[0];
            var y = cubie.currPosition[1];
            var z = cubie.currPosition[2];
            lockedCubies.push(new Cubie(x,y,z,'gray'));

        });
        // Check if rows need to be cleared
        lockedCubies.clearRows();
        // If game is over due to win, end game
        if (isGameOver) {
            currTetromino.clear();
            return;
        }
        // Spawn a new Tetromino
        spawnTetromino();
        // Stop falling after drop to reset drop interval
        //currTetromino.stopFalling();
        //currTetromino.startFalling(fallInterval);
        // Check if new Tetromino will result in game over
        if (lockedCubies.gameOver()) {
            currTetromino.stopFalling();
            displayGameMessage("Game over.");
            isGameOver = true;
            isGameStarted = false;
            isGamePaused = false;
            document.getElementById('startButton').disabled = false;
            document.getElementById('pauseButton').disabled = true;
            document.getElementById('resetButton').disabled = true;
            document.getElementById('endButton').disabled = true;
            // Reenable sliders
            document.getElementById('gridSizeSlider').disabled = false;
            document.getElementById('levelSlider').disabled = false;
        }
    }

    // For setInterval and clearInterval
    this.interval;

    // Tells Tetromino to start falling
    this.startFalling = function(delay) {
        // Tetromino will fall in between intervals, stops falling when the game stops    
        this.interval = setInterval(function() {
            enqueueAction('translation','down');
        }, delay);
    }

    // Forces Tetromino to stop falling
    this.stopFalling = function() {
        clearInterval(this.interval);
    }
}

var tetrominoTable = ['I','O','T','J','L','S','Z','Tvar','Svar','Zvar'];

// Current Tetromino piece
// Initialize to placeholder but not actually rendered
var currTetromino = new Tetromino();

// Spawn a new Tetromino piece
// Ensures that no same piece can be spawned consecutively
var spawnTetromino = function() {
    var indexOfPreviousPiece = tetrominoTable.indexOf(currTetromino.previousPiece);
    var currTetrominoTable = tetrominoTable.slice();
    // Check if there was a previous piece (i.e. if start of game)
    // If so, remove it from list
    if (indexOfPreviousPiece != -1) {
        currTetrominoTable.splice(indexOfPreviousPiece,1);
    }
    currTetromino.clear();
    if (!DEMO) {
    currTetromino.init(currTetrominoTable[Math.floor(Math.random()*currTetrominoTable.length)]);
    } else { // SPAM I BLOCKS FOR DEMO
    currTetromino.init("I");
    }

    // Reload color buffer for new Tetromino
    // Want to only change the first 36 colors for this Tetromino
    for (var i = 0; i < NumVertices; ++i) {
        colors[i] = colorTable[currTetromino.color];
    }

    var cBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW );

    var vColor = gl.getAttribLocation( program, "vColor" );
    gl.vertexAttribPointer( vColor, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vColor );
}

// -------------------------
// Action queue functions
// -------------------------

// Push action onto action queue
function enqueueAction(action, direction) {
    actionQueue.push([action,direction]);
    // Want to try start an action as soon as you push one on
    dequeueAction();
}

// Pop action from action queue
function dequeueAction() {
    // If no actions available or if an action is currently taking place, do nothing
    // Don't have to worry about translations taking place because it occurs in one frame
    // Need to make sure no dequeues happen while a rotation is occurring
    if (actionQueue.length == 0 || (rotationAngle > 0 && rotationAngle < 90)) {
        return;
    }
    // If an action is possible, pop off the action parameters
    var nextAction = actionQueue.shift();

    // Check if next action is a translation or rotation
    currentAction = nextAction[0];
    if (currentAction == 'translation') {
        translationDir = nextAction[1];
    } else if (currentAction == 'rotation') {
        rotationDir = nextAction[1];
    }
}

// -------------------------
// Set up event listeners
// -------------------------

function initEventListeners() {

    // --------------------------
    // Event listeners for keys
    // --------------------------

    document.onkeydown = function(e) {

        // If game hasn't started, is over, or is paused ignore commands
        if (!isGameStarted || isGameOver || isGamePaused) { return; }

        switch (e.keyCode) {
            case 39: // right arrow, move right
                if (!e.shiftKey) {
                    enqueueAction('translation','right');
                } else {
                    enqueueAction('rotation','xCCW');
                }
                e.preventDefault();
                break;

            case 37: // left arrow, move left
                if (!e.shiftKey) {
                    enqueueAction('translation','left');
                } else {
                    enqueueAction('rotation','xCW');
                }
                e.preventDefault();
                break;

            case 38: // up arrow
                if (e.shiftKey) {
                    enqueueAction('rotation','yCCW');
                }
                break;

            case 40: // down arrow, move down
                if (!e.shiftKey) {
                    enqueueAction('translation','down');
                } else {
                    enqueueAction('rotation','yCW');
                }
                e.preventDefault();
                break;

            case 90: // Z, move front
                if (!e.shiftKey) {
                    enqueueAction('translation','front');
                } else {
                    enqueueAction('rotation','zCCW');
                }
                e.preventDefault();
                break;

            case 88: // X, move back
                if (!e.shiftKey) {
                    enqueueAction('translation','back');
                } else {
                    enqueueAction('rotation','zCW');
                }
                e.preventDefault();
                break;

            case 32: // space bar, hard drop
                enqueueAction('translation','drop');
                e.preventDefault();
                break;
        }
    }

    // --------------------------
    // Event listeners for mouse
    // --------------------------

    // Checks if mouse button is held
    var heldDown = false;

    var startX, startY;

    canvas.addEventListener("mousedown", function(e) {
        heldDown = true;
        // Keep track of starting x and y positions
        startX = e.pageX;
        startY = e.pageY;
        e.preventDefault();
        return false;
    });

    canvas.addEventListener("mouseup", function(e) {
        heldDown = false;
    });

    canvas.addEventListener("mousemove", function(e) {
        // If mouse isn't held down, nothing happens
        if (!heldDown) {
            return false;
        }
        // Otherwise, if mouse is held down, rotate the cube if dragged/
        // First find the distance between the old and new mouse positions
        // Then convert into radians by comparing it with the canvas dimensions
        // Negative d means counterclockwise
        dTHETA = (e.pageX-startX)*2*Math.PI/canvas.width;
        dPHI = (e.pageY-startY)*2*Math.PI/canvas.height;

        // Subtract PHI first, then check for discontinuity (otherwise flip glitch)
        PHI = (PHI-dPHI)%(2*Math.PI);

        // From degrees(PHI) E [-180, 0] U [180, 360], the up vector begins to point in
        // the opposite direction and the cube flips to preserve the up direction.
        // We don't want this to happen, so we flip the up vector when this happens
        // (also changes direction of rotation for THETA).
        if ((PHI > Math.PI && PHI < 2*Math.PI) || (PHI < 0 && PHI > -Math.PI)) {
            up = vec3(0.0, -1.0, 0.0);
            THETA = (THETA+dTHETA)%(2*Math.PI);
        } else {
            up = vec3(0.0, 1.0, 0.0);
            THETA = (THETA-dTHETA)%(2*Math.PI);
        }

        // Save ending position as next starting position
        startX = e.pageX;
        startY = e.pageY;
        e.preventDefault();
    });

    canvas.addEventListener("mousewheel", function(e) {
        // Restrict to minimum and maximum zoom windows
        if (cameraRadius - e.wheelDelta/75 < cameraRadiusMin) {
            cameraRadius = cameraRadiusMin;
        } else if (cameraRadius - e.wheelDelta/75 > cameraRadiusMax) {
            cameraRadius = cameraRadiusMax;
        // If restrictions are not met, just zoom in or out
        } else {
            cameraRadius -= e.wheelDelta/75;
        }
    });

    // ----------------------------
    // Event listeners for buttons
    // ----------------------------

    document.getElementById('startButton').onclick = function() {
        // Check flags
        isGameStarted = true;
        isGameOver = false;
        isGamePaused = false;
        // Reset score
        gameScore = 0;
        updateScoreboard();
        // Set level display
        gameLevel = startingGameLevel;
        updateGameLevel();
        // Clear game message
        resetGameMessage();
        // Disable start and enable pause/restart after game starts
        document.getElementById('startButton').disabled = true;
        document.getElementById('pauseButton').disabled = false;
        document.getElementById('resetButton').disabled = false;
        document.getElementById('endButton').disabled = false;
        // Disable sliders when game is starting
        document.getElementById('gridSizeSlider').disabled = true;
        document.getElementById('levelSlider').disabled = true;
        // Clear grid and set to size indicated by slider
        gridBottom.clear();
        gridLeftWall.clear();
        gridBackWall.clear();
        gridBottom.init();
        gridLeftWall.init();
        gridBackWall.init();
        // Clear and resize grid
        lockedCubies.init();
        // Spawn new Tetrimino
        spawnTetromino();
        // Tell Tetrimino to start falling
        currTetromino.startFalling(fallInterval);
    }

    document.getElementById('pauseButton').onclick = function() {
        isGamePaused = !isGamePaused;
        // Pause, stop falling
        if (isGamePaused) {
            currTetromino.stopFalling();
            displayGameMessage("Paused.");
        }
        // Unpause, start falling again
        else {
            resetGameMessage();
            currTetromino.startFalling(fallInterval);
        }
    }

    // Restart the game when it is in progress
    document.getElementById('resetButton').onclick = function() {
        // First stop falling
        currTetromino.stopFalling();
        isGameStarted = true;
        isGameOver = false;
        isGamePaused = false;
        gameScore = 0;
        updateScoreboard();
        gameLevel = startingGameLevel;
        updateGameLevel();
        resetGameMessage();
        gridBottom.clear();
        gridLeftWall.clear();
        gridBackWall.clear();
        gridBottom.init();
        gridLeftWall.init();
        gridBackWall.init();
        lockedCubies.init();
        spawnTetromino();
        // Finally restart falling
        currTetromino.startFalling(fallInterval);
    }

    // End the game when it is in progress, simulates game over state
    document.getElementById('endButton').onclick = function() {
        // End button stops falling, start button will restart falling
        currTetromino.stopFalling();
        displayGameMessage("Game ended.");
        isGameOver = true;
        isGameStarted = false;
        isGamePaused = false;
        document.getElementById('startButton').disabled = false;
        document.getElementById('pauseButton').disabled = true;
        document.getElementById('resetButton').disabled = true;
        document.getElementById('endButton').disabled = true;
        // Reenable sliders
        document.getElementById('gridSizeSlider').disabled = false;
        document.getElementById('levelSlider').disabled = false;
    }

    // -----------------------------------------
    // Event listeners for sliders
    // -----------------------------------------

    document.getElementById("gridSizeSlider").onchange = function(e) {

        // Maps slider values to actual values
        var gridSize = parseInt(e.target.value);
        switch(gridSize) {
            case 0:
                // 4x11x4
                grid_Xp = 1;
                grid_Xn = -2;
                grid_Yp = 5;
                grid_Yn = -5;
                grid_Zp = 1;
                grid_Zn = -2;
                break;
            case 1:
                // 5x14x5
                grid_Xp = 2;
                grid_Xn = -2;
                grid_Yp = 6;
                grid_Yn = -7;
                grid_Zp = 2;
                grid_Zn = -2;
                break;
            case 2:
                // 6x17x6
                grid_Xp = 2;
                grid_Xn = -3;
                grid_Yp = 8;
                grid_Yn = -8;
                grid_Zp = 2;
                grid_Zn = -3;
                break;
        }
    };

    document.getElementById("levelSlider").onchange = function(e) {
        startingGameLevel = parseInt(e.target.value);
        gameLevel = startingGameLevel;
        fallInterval = fallIntervals[gameLevel];
    };
}

// ----------------------------------------
// Init function to prepare for rendering
// ----------------------------------------

window.onload = function init()
{
    canvas = document.getElementById( "gl-canvas" );

    // Set up WebGL
    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    gl.viewport( 0, 0, canvas.width, canvas.height );
    //gl.clearColor( 1.0, 1.0, 1.0, 1.0 ); //white
    //gl.clearColor( 1.0, 0.5, 0.6, 0.75 ); //pink
    gl.clearColor( 0.0, 0.0, 0.0, 1.0 ); //black

    gl.enable(gl.DEPTH_TEST);

    // Load shaders and initialize attribute buffers
    program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    // Push in vertices to vertex buffer
    // 0-36 is Tetromino cubie
    // 36-60 is cubie outline
    // 60-78 is grid square
    // 78-114 is locked cubie
    cubelet(vertexPos);
    GridQuad( 3, 0, 4, 7, vertexPos); // bottom
    GridQuad( 5, 4, 0, 1, vertexPos); // left
    GridQuad( 4, 5, 6, 7, vertexPos); // back
    cubelet(vertexPos);

    // Load the normal buffers
    var nBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, nBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW );

    var vNormal = gl.getAttribLocation( program, "vNormal" );
    gl.vertexAttribPointer( vNormal, 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vNormal );

    // Load the vertex buffers
    var vBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW );

    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );

    // Load the color buffers
    var cBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW );

    var vColor = gl.getAttribLocation( program, "vColor" );
    gl.vertexAttribPointer( vColor, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vColor );

    // Set up uniforms
    worldViewMatrixLoc = gl.getUniformLocation(program, "worldViewMatrix");
    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");

    // Initialize event listeners
    initEventListeners();

    // Start button should be enabled (disabled during game)
    // Pause button should be disabled (only enabled in game)
    // Restart button should be disabled (enabled in game)
    /// End button should be disabled (enabled in game)
    document.getElementById('startButton').disabled = false;
    document.getElementById('pauseButton').disabled = true;
    document.getElementById('resetButton').disabled = true
    document.getElementById('endButton').disabled = true;

    // Initialize the scoreboard to 0
    updateScoreboard();

    // Initialize the game level to 0
    updateGameLevel();

    // Clear the game message
    resetGameMessage();

    // Lighting

    var ambientProduct = mult(lightAmbient, materialAmbient);
    var diffuseProduct = mult(lightDiffuse, materialDiffuse);
    var specularProduct = mult(lightSpecular, materialSpecular);

    gl.uniform4fv(gl.getUniformLocation(program, "ambientProduct"),
       flatten(ambientProduct));
    gl.uniform4fv(gl.getUniformLocation(program, "diffuseProduct"),
       flatten(diffuseProduct) );
    gl.uniform4fv(gl.getUniformLocation(program, "specularProduct"),
       flatten(specularProduct) );
    gl.uniform4fv(gl.getUniformLocation(program, "lightPosition"),
       flatten(lightPosition) );
    gl.uniform1f(gl.getUniformLocation(program, "shininess"),
        materialShininess);

    render();
}

// -------------------------------
// Render function for each frame
// -------------------------------

function render()
{

    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // -------------------------
    // Set up view matrices
    // -------------------------

    // Set the camera position at each render (spherical coordinates)
    eye = vec3(cameraRadius*Math.sin(PHI)*Math.sin(THETA),
            cameraRadius*Math.cos(PHI),
            cameraRadius*Math.sin(PHI)*Math.cos(THETA));

    // World view matrix
    // Initialize to identity matrix
    worldViewMatrix = mat4();
    
    // Model-view matrix
    modelViewMatrix = mat4();
    modelViewMatrix = mult(lookAt(eye, at, up), modelViewMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));

    // Projection matrix
    projectionMatrix = perspective(fovy, aspect, near, far);
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

    // -------------------------
    // Render the grid
    // -------------------------

    // Render the grid bottom
    gridBottom.squares.forEach(function(square) {

        // Get the square's world view matrix
        worldViewMatrix = mult(square.getWorldMatrix(), worldViewMatrix);
        gl.uniformMatrix4fv(worldViewMatrixLoc, false, flatten(worldViewMatrix));

        // Draw arrays
        // 60-66 is grid bottom square, white
        gl.drawArrays(gl.TRIANGLES, 60, 6);

        // Reset world view matrix
        worldViewMatrix = mat4(); 
    });

    // Render the grid left wall
    gridLeftWall.squares.forEach(function(square) {

        worldViewMatrix = mult(square.getWorldMatrix(), worldViewMatrix);
        gl.uniformMatrix4fv(worldViewMatrixLoc, false, flatten(worldViewMatrix));

        // Vertices 66-72 is grid left wall square, white
        gl.drawArrays(gl.TRIANGLES, 66, 6);

        worldViewMatrix = mat4();
    });

    // Render the grid back wall
    gridBackWall.squares.forEach(function(square) {

        worldViewMatrix = mult(square.getWorldMatrix(), worldViewMatrix);
        gl.uniformMatrix4fv(worldViewMatrixLoc, false, flatten(worldViewMatrix));

        // Vertices 72-78 is grid back wall square, white
        gl.drawArrays(gl.TRIANGLES, 72, 6);

        worldViewMatrix = mat4();
    });

    // ----------------------------------------
    // Apply Tetromino transformations, if any
    // ----------------------------------------

    if (currentAction == 'translation') {
        // Check if action is drop
        if (translationDir == 'drop') {
            currTetromino.drop();
        } else {
            currTetromino.translate(translationDir);
        }
        // Reset the flag until the next action is popped
        currentAction = 'none';
        // Continue dequeuing actions until action queue is depleted
        dequeueAction();
    } else if (currentAction == 'rotation') {
        currTetromino.rotate(rotationDir);
        rotationAngle += rotationSpeed;
        if (rotationAngle == 90.0) {
            currTetromino.updateRotationLocation();
            currentAction = 'none';
            rotationAngle = 0;
            dequeueAction();
        }
    }

    // ----------------------------------------
    // Render the current Tetromino
    // ----------------------------------------

    // Render each cubie for the Tetromino
    currTetromino.cubies.forEach(function(cubie) {

        worldViewMatrix = mult(cubie.getWorldMatrix(), worldViewMatrix);
        gl.uniformMatrix4fv(worldViewMatrixLoc, false, flatten(worldViewMatrix));

        // Vertices 0-36 is Tetromino cubie, color is reloaded when spawning Tetromino
        gl.drawArrays(gl.TRIANGLES, 0, NumVertices);

        worldViewMatrix = mat4();
    });

    // ----------------------------------------
    // Render the locked in Tetrominos
    // ----------------------------------------

    // Render each cubie for the locked in pieces
    // Need to go through rows first, then the cubies in each row
    lockedCubies.cubies.forEach(function(row) {

        row.forEach(function(cubie) {

            worldViewMatrix = mult(cubie.getWorldMatrix(), worldViewMatrix);
            gl.uniformMatrix4fv(worldViewMatrixLoc, false, flatten(worldViewMatrix));

            // Vertices 78-114 is locked cubie, color is gray
            gl.drawArrays(gl.TRIANGLES, 78, NumVertices);

            worldViewMatrix = mat4();
        });
    });

    // ----------------------------------------
    // Render the cubie outlines
    // ----------------------------------------

    // Render the outlines for the Tetromino
    currTetromino.cubies.forEach(function(cubie) {

        worldViewMatrix = mult(cubie.getWorldMatrix(), worldViewMatrix);
        gl.uniformMatrix4fv(worldViewMatrixLoc, false, flatten(worldViewMatrix));

        // Draw lines instead of triangles
        // Vertices 36-60 is cubie outline, color is black
        gl.drawArrays(gl.LINES, 36, 24);

        worldViewMatrix = mat4();
    });


    lockedCubies.cubies.forEach(function(row) {

        row.forEach(function(cubie) {

            worldViewMatrix = mult(cubie.getWorldMatrix(), worldViewMatrix);
            gl.uniformMatrix4fv(worldViewMatrixLoc, false, flatten(worldViewMatrix));

            // Vertices 36-60 is cubie outline, color is black
            gl.drawArrays(gl.LINES, 36, 24);

            worldViewMatrix = mat4();
        });
    });

    requestAnimFrame( render );
}
