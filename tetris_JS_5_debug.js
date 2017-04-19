// Next steps:
// Freeze bug, idk why (note: this happened in Rubix too)
// Improve speed in general
// Deal with game over condition
// Differentiate spawn spot from game spot

"use strict"

var canvas;
var gl;
var program;

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

// Vertex buffers used for rendering
var CubiePoints = [];
var LinePoints = [];
var GridPoints = [];

// --------------------------------
// Grid boundaries
// --------------------------------

var grid_size = 1;
if (grid_size) {
var grid_Xp = 3;
var grid_Xn = -3;
var grid_Yp = 6;
var grid_Yn = -6;
var grid_Zp = 3;
var grid_Zn = -3;
} else {
var grid_Xp = 1;
var grid_Xn = -2;
var grid_Yp = 4;
var grid_Yn = -4;
var grid_Zp = 1;
var grid_Zn = -2;
}

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
    'gray'      : vec4( 0.0, 0.0, 0.0, 0.5 )
}

// ---------------------------------
// Game logic
// ---------------------------------

var score = 0;

// Make sure you do this after the DOM object is generated (in window.onload)
var updateScoreboard = function() {
    document.getElementById("scoreboard").innerHTML = "Score: " + score.toString();
    //document.getElementById("scoreboard").innerHTML = score.toString();
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

// LEFT OFF &&&

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

    // 6 vertices determine a face in a quad (2 triangles)
    var indices = [ a, b, c, a, c, d ];
    for ( var i = 0; i < indices.length; ++i ) {
        // Push the vertices into the vertex array
        CubiePoints.push( vertices[indices[i]] );
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

    var indices = [ a, b, c, d ];
    for ( var i = 0; i < indices.length; ++i ) {
        LinePoints.push( vertices[indices[i]] );
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

    // 6 vertices determine a face in a quad (2 triangles)
    var indices = [ a, b, c, a, c, d ];
    for ( var i = 0; i < indices.length; ++i ) {
        // Push the vertices into the vertex array
        GridPoints.push( vertices[indices[i]] );
    }
}

// ---------------------------------------------
// Grid Square class, analogous to Cubie class
// ---------------------------------------------

function GridSquare(x, y, z) {

    // Places grid square where it should be in the grid
    this.placementMatrix = translate(x*spacing, y*spacing, z*spacing);

    // Grid color, white for now
    this.colors = [];
    for (var i = 0; i < 6; i++) {
        this.colors.push(colorTable['white']);   
    }

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

function Cubie(x, y, z, color) {

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
    this.colors = [];
    for (var i = 0; i < NumVertices; i++) {
        this.colors.push(colorTable[color]);    
    }

    // Cubie's outline colors
    this.lineColors = [];
    for (var i = 0; i < NumVertices; i++) {
        this.lineColors.push(colorTable['black']);    
    }

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
    this.cubies = []
    for (var i = 0; i < grid_Yp-grid_Yn+1; ++i) {
       this.cubies.push([]);
    }
    //console.log(this.cubies)

    this.colors = []
    for (var i = 0; i < NumVertices; ++i) {
        this.colors.push(colorTable['gray']);   
    }

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

        // Most important, determines if a Tetromino should be locked or not
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
                //console.log("NEXT", nextPosition, "LOCKED", lockedCubie.currPosition)
                //console.log("IS EQUAL?", equalVector(nextPosition,lockedCubie.currPosition))
                if (equalVector(nextPosition, lockedCubie.currPosition)) {
                    bool = true;
                    return;
                }
            });
        });

        return bool;
    }

    // Clear rows every time a row is locked
    this.clearRows = function() {

        // Keep track of how many lines are cleared at once to add to score accordingly
        var linesCleared = 0;

        // Check from bottom row to topmost row of cubies
        for (var row = grid_Yn; row <= this.height; ++row) {
            // Check if row is full
            console.log("CURRENT ROW", row-grid_Yn, ", HEIGHT", this.height-grid_Yn);
            console.log("CUBIES IN THIS ROW: ", this.cubies[row-grid_Yn].length);
            console.log("MAX CUBIES IN ROW: ", (grid_Xp-grid_Xn+1)*(grid_Zp-grid_Zn+1));
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
            score += 1000*Math.pow(2,linesCleared-1);
        }
        linesCleared = 0;
        updateScoreboard();
    }
}

var lockedCubies = new Locked();

// -------------------------
// Tetromino class
// -------------------------

function Tetromino(type) {

    this.cubies = [];

    // Initialize Tetromino based on type
    this.init = function() {
        if (type == 'I') {
            this.cubies.push(new Cubie(-2,0,0,'cyan'));
            this.cubies.push(new Cubie(-1,0,0,'cyan'));
            this.cubies.push(new Cubie(-0,0,0,'cyan'));
            this.cubies.push(new Cubie(1,0,0,'cyan'));
        } else if (type == 'O') {
            this.cubies.push(new Cubie(-1,0,0,'yellow'));
            this.cubies.push(new Cubie(0,0,0,'yellow'));
            this.cubies.push(new Cubie(-1,-1,0,'yellow'));
            this.cubies.push(new Cubie(0,-1,0,'yellow'));
        } else if (type == 'T') {
            this.cubies.push(new Cubie(-1,0,0,'magenta'));
            this.cubies.push(new Cubie(0,0,0,'magenta'));
            this.cubies.push(new Cubie(1,0,0,'magenta'));
            this.cubies.push(new Cubie(0,-1,0,'magenta'));
        } else if (type == 'J') {
            this.cubies.push(new Cubie(-1,0,0,'blue'));
            this.cubies.push(new Cubie(0,0,0,'blue'));
            this.cubies.push(new Cubie(1,0,0,'blue'));
            this.cubies.push(new Cubie(1,-1,0,'blue'));
        } else if (type == 'L') {
            this.cubies.push(new Cubie(-1,0,0,'orange'));
            this.cubies.push(new Cubie(0,0,0,'orange'));
            this.cubies.push(new Cubie(1,0,0,'orange'));
            this.cubies.push(new Cubie(-1,-1,0,'orange'));
        } else if (type == 'S') {
            this.cubies.push(new Cubie(0,0,0,'green'));
            this.cubies.push(new Cubie(1,0,0,'green'));
            this.cubies.push(new Cubie(-1,-1,0,'green'));
            this.cubies.push(new Cubie(0,-1,0,'green'));
        } else if (type == 'Z') {
            this.cubies.push(new Cubie(-1,0,0,'red'));
            this.cubies.push(new Cubie(0,0,0,'red'));
            this.cubies.push(new Cubie(0,-1,0,'red'));
            this.cubies.push(new Cubie(1,-1,0,'red'));
        }
        // Place Tetromino at the top
        this.cubies.forEach(function(cubie) {
            cubie.translationMatrixSpaced = mult(translate(0,grid_Yp*spacing,0), cubie.translationMatrixSpaced);
            cubie.translationMatrix = mult(translate(0,grid_Yp,0), cubie.translationMatrix);
            cubie.currPosition = mult(translate(0,grid_Yp,0), cubie.currPosition);
        });
    }

    // NEED TO CHECK COLLISIONS DUE TO TRANSLATION AND ROTATIONS WITH OTHER PIECES
    // First, check collision when falling

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
        //console.log(this.canTranslate(direction))
        if (this.canTranslate(direction)) {
            this.cubies.forEach(function(cubie) {
                //console.log("before TRANSlATE", cubie.currPosition)
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
                //console.log('after TRANSLATE', cubie.currPosition)
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
                //console.log('CUBIE', i++);
                //console.log("currrot",cubie.origPosition)
                newPos = mult(cubie.prevRotationMatrix, cubie.origPosition);
                //console.log("rot1",cubie.currPosition)
                newPos = roundVector(mult(rotateY(90.0), newPos));
                //console.log("rot2",cubie.currPosition)
                newPos = mult(cubie.translationMatrix, newPos);
                //console.log("newrot",newPos)
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
        console.log("I AM LOCKING")
        // Add to locked cubes
        this.cubies.forEach(function(cubie) {
            var x = cubie.currPosition[0];
            var y = cubie.currPosition[1];
            var z = cubie.currPosition[2];
            lockedCubies.push(new Cubie(x,y,z,'gray'));

        });
        // Check if rows need to be cleared
        lockedCubies.clearRows();
        // Spawn a new Tetromino
        // Later change it so that the same one can't be spawned consecutively
        currTetromino = new Tetromino(tetrominoTable[Math.floor(Math.random()*tetrominoTable.length)]);
        //currTetromino = new Tetromino("I");
        currTetromino.init();
    }
}

var tetrominoTable = ['I','O','T','J','L','S','Z'];
var currTetromino = new Tetromino(tetrominoTable[Math.floor(Math.random()*tetrominoTable.length)]);
//currTetromino = new Tetromino("I");
currTetromino.init();

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
        switch (e.keyCode) {
            case 39: // right arrow, move right
                if (!e.shiftKey) {
                    enqueueAction('translation','right');//, -1*(e.shiftKey ? -1 : 1));
                } else {
                    enqueueAction('rotation','xCCW');
                }
                e.preventDefault();
                break;

            case 37: // left arrow, move left
                if (!e.shiftKey) {
                    enqueueAction('translation','left');//, -1*(e.shiftKey ? -1 : 1));
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
                    enqueueAction('translation','down');//,-1*(e.shiftKey ? -1 : 1));
                } else {
                    enqueueAction('rotation','yCW');
                }
                e.preventDefault();
                break;

            case 90: // Z, move front
                if (!e.shiftKey) {
                    enqueueAction('translation','front');//,-1*(e.shiftKey ? -1 : 1));
                } else {
                    enqueueAction('rotation','zCCW');
                }
                e.preventDefault();
                break;

            case 88: // X, move back
                if (!e.shiftKey) {
                    enqueueAction('translation','back');//,-1*(e.shiftKey ? -1 : 1));
                } else {
                    enqueueAction('rotation','zCW');
                }
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

        // From degrees(PHI) E [-180, 0] U [180, 360], the up vector begins to point in
        // the opposite direction and the cube flips to preserve the up direction.
        // We don't want this to happen, so we flip the up vector when this happens
        // (also changes direction of rotation for THETA).
        if ((PHI > Math.PI && PHI < 2*Math.PI) || (PHI < 0 && PHI > -Math.PI)) {
            up = vec3(0.0, -1.0, 0.0);
            THETA = (THETA+dTHETA)%(2*Math.PI);
            // Jump over discontinuity
            if (THETA == Math.PI) {
                THETA += radians(5);
            }
        } else {
            up = vec3(0.0, 1.0, 0.0);
            THETA = (THETA-dTHETA)%(2*Math.PI);
            // Jump over discontinuity
            if (THETA == Math.PI) {
                THETA -= radians(5);
            }
        }
        PHI = (PHI-dPHI)%(2*Math.PI);

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
    //gl.clearColor( 1.0, 0.5, 0.6, 0.75 ); //pink
    //gl.clearColor( 1.0, 1.0, 1.0, 1.0 ); //white
    gl.clearColor( 0.0, 0.0, 0.0, 1.0 ); //black

    gl.enable(gl.DEPTH_TEST);

    // Initialize the grid bottom
    gridBottom.init();
    gridLeftWall.init();
    gridBackWall.init();

    // Push in vertices for grid bottom template
    GridQuad( 3, 0, 4, 7, vertexPos);
    GridQuad( 5, 4, 0, 1, vertexPos); // left face
    GridQuad( 4, 5, 6, 7, vertexPos); // back face
    // GridLeftWallSquare();
    // GridBackWallSquare();

    cubelet(vertexPos);

    // Load shaders and initialize attribute buffers
    program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    // Set up uniforms
    worldViewMatrixLoc = gl.getUniformLocation(program, "worldViewMatrix");
    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");

    // Initialize event listeners
    initEventListeners();

    // Initialize the scoreboard to 0
    updateScoreboard();

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
    //var orthoTop = 10;
    //projectionMatrix = ortho(-orthoTop, orthoTop, -orthoTop, orthoTop, near, far);
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

    // -------------------------
    // Render the grid
    // -------------------------

    // Put the grid bottom template tile in the buffer
    var vBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(GridPoints.slice(0,6)), gl.STATIC_DRAW );

    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );

    // Render the grid bottom
    gridBottom.squares.forEach(function(square) {

        // Get the square's world view matrix
        worldViewMatrix = mult(square.getWorldMatrix(), worldViewMatrix);
        gl.uniformMatrix4fv(worldViewMatrixLoc, false, flatten(worldViewMatrix));

        // Grid color
        var cBuffer = gl.createBuffer();
        gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
        gl.bufferData( gl.ARRAY_BUFFER, flatten(square.colors), gl.STATIC_DRAW );

        var vColor = gl.getAttribLocation( program, "vColor" );
        gl.vertexAttribPointer( vColor, 4, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( vColor );

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Reset world view matrix
        worldViewMatrix = mat4(); 
    });

    // Put the grid left wall template tile in the buffer
    var vBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(GridPoints.slice(6,12)), gl.STATIC_DRAW );

    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );

    // Render the grid left wall
    gridLeftWall.squares.forEach(function(square) {

        worldViewMatrix = mult(square.getWorldMatrix(), worldViewMatrix);
        gl.uniformMatrix4fv(worldViewMatrixLoc, false, flatten(worldViewMatrix));

        var cBuffer = gl.createBuffer();
        gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
        gl.bufferData( gl.ARRAY_BUFFER, flatten(square.colors), gl.STATIC_DRAW );

        var vColor = gl.getAttribLocation( program, "vColor" );
        gl.vertexAttribPointer( vColor, 4, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( vColor );

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        worldViewMatrix = mat4();
    });

    // Put the grid left wall template tile in the buffer
    var vBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(GridPoints.slice(12,18)), gl.STATIC_DRAW );

    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );

    // Render the grid back wall
    gridBackWall.squares.forEach(function(square) {

        worldViewMatrix = mult(square.getWorldMatrix(), worldViewMatrix);
        gl.uniformMatrix4fv(worldViewMatrixLoc, false, flatten(worldViewMatrix));

        var cBuffer = gl.createBuffer();
        gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
        gl.bufferData( gl.ARRAY_BUFFER, flatten(square.colors), gl.STATIC_DRAW );

        var vColor = gl.getAttribLocation( program, "vColor" );
        gl.vertexAttribPointer( vColor, 4, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( vColor );

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        worldViewMatrix = mat4();
    });

    // ----------------------------------------
    // Apply Tetromino transformations, if any
    // ----------------------------------------

    if (currentAction == 'translation') {
        currTetromino.translate(translationDir);
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

    // Load the cubie template in the buffer
    var vBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(CubiePoints), gl.STATIC_DRAW );

    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );

    // Render each cubie for the Tetromino
    currTetromino.cubies.forEach(function(cubie) {

        worldViewMatrix = mult(cubie.getWorldMatrix(), worldViewMatrix);
        gl.uniformMatrix4fv(worldViewMatrixLoc, false, flatten(worldViewMatrix));
 
        var cBuffer = gl.createBuffer();
        gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
        gl.bufferData( gl.ARRAY_BUFFER, flatten(cubie.colors), gl.STATIC_DRAW );

        var vColor = gl.getAttribLocation( program, "vColor" );
        gl.vertexAttribPointer( vColor, 4, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( vColor );

        gl.drawArrays(gl.TRIANGLES, 0, NumVertices);

        worldViewMatrix = mat4();
    });

    // ----------------------------------------
    // Render the locked in Tetrominos
    // ----------------------------------------

    // Note: The cubie template is already loaded, don't need to reload

    // Render each cubie for the locked in pieces
    // Need to go through rows first, then the cubies in each row
    lockedCubies.cubies.forEach(function(row) {

        row.forEach(function(cubie) {

            worldViewMatrix = mult(cubie.getWorldMatrix(), worldViewMatrix);
            gl.uniformMatrix4fv(worldViewMatrixLoc, false, flatten(worldViewMatrix));

            var cBuffer = gl.createBuffer();
            gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
            gl.bufferData( gl.ARRAY_BUFFER, flatten(lockedCubies.colors), gl.STATIC_DRAW );

            var vColor = gl.getAttribLocation( program, "vColor" );
            gl.vertexAttribPointer( vColor, 4, gl.FLOAT, false, 0, 0 );
            gl.enableVertexAttribArray( vColor );

            gl.drawArrays(gl.TRIANGLES, 0, NumVertices);

            worldViewMatrix = mat4();
        });
    });

    // ----------------------------------------
    // Render the cubie outlines
    // ----------------------------------------

    // Load in the cubie outline template
    var vBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(LinePoints), gl.STATIC_DRAW );

    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );

    // Render the outlines for the Tetromino
    currTetromino.cubies.forEach(function(cubie) {

        worldViewMatrix = mult(cubie.getWorldMatrix(), worldViewMatrix);
        gl.uniformMatrix4fv(worldViewMatrixLoc, false, flatten(worldViewMatrix));

        var cBuffer = gl.createBuffer();
        gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
        gl.bufferData( gl.ARRAY_BUFFER, flatten(cubie.lineColors), gl.STATIC_DRAW );

        var vColor = gl.getAttribLocation( program, "vColor" );
        gl.vertexAttribPointer( vColor, 4, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( vColor );

        // Draw lines instead of triangles
        gl.drawArrays(gl.LINES, 0, 24);

        worldViewMatrix = mat4();
    });

    // Render the outlines for the locked in pieces
    lockedCubies.cubies.forEach(function(row) {

        row.forEach(function(cubie) {

            worldViewMatrix = mult(cubie.getWorldMatrix(), worldViewMatrix);
            gl.uniformMatrix4fv(worldViewMatrixLoc, false, flatten(worldViewMatrix));

            var cBuffer = gl.createBuffer();
            gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
            gl.bufferData( gl.ARRAY_BUFFER, flatten(cubie.lineColors), gl.STATIC_DRAW );

            var vColor = gl.getAttribLocation( program, "vColor" );
            gl.vertexAttribPointer( vColor, 4, gl.FLOAT, false, 0, 0 );
            gl.enableVertexAttribArray( vColor );

            gl.drawArrays(gl.LINES, 0, 24);

            worldViewMatrix = mat4();
        });
    });

    requestAnimFrame( render );
}


/*

var canvas;
var gl;
var program;

// Number of vertices to draw in drawArray function
var NumVertices = 36;

// Absolute value of each coordinate of each vertex for center cube
var vertexPos = 0.5;

// Length of side of one of the cubelets
var sidelen = 2*vertexPos;

// Spacing between cubelets
var spacing = 1.1;

// Vertex and color buffers used for rendering
var points = [];
var colors = [];

// Spherical coordinate angles for rotating the cube
// Distinguished with THETA_START and PHI_START, which are for the camera
// dPHI and dTHETA are the incremental angles to add to THETA and PHI while rotating
var THETA = radians(45);
var PHI = radians(45);
var dTHETA = 0;
var dPHI = 0;

// For rotating whole cube with mouse
var AMORTIZATION = 0.95; // used to scale down PHI and THETA to produce fading motion
var heldDown = false; // checks if mouse button is held

// Camera distance from object
var cameraRadius = 20.0;

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

// For face rotations
var rotationAxis = 0;
var rotationFace = 'none';
var rotationDir; // 1 indicates CW, -1 is CCW

// Used for rotation speed
// Temporary is used for switching speeds using the slider during a sequence of rotations
// Value of slider is stored in temp, then used for the actual speed only after a turn is done
var rotationSpeed = 15.0;
var rotationSpeedTemp = rotationSpeed;

// Indicator to check if a cubelet has rotated one turn (up to 90 degrees)
// Initialized at 90 so no rotations occur (rotation occurs only if <90)
var rotationAngle = 90;

// Queue for rotations, a rotation doesn't happen until the preceding rotations in the queue occur
var rotationQueue = [];

// Indicators for each axis for rotations
var xAxis = 0;
var yAxis = 1;
var zAxis = 2;

// Store angle positions for each cubelet
// Cubelet positions are their current positions, not their old ones
// Angle values get reset after a full turn
var thetaCubelet = new Array();
for (var ix = -1; ix <= 1; ix++) {
    var tempArrX = new Array();
    for (var iy = -1; iy <= 1; iy++) {
        var tempArrY = new Array();
        for (var iz = -1; iz <= 1; iz++) {
            tempArrY.push([0,0,0]);
        }
        tempArrX.push(tempArrY);
    }
    thetaCubelet.push(tempArrX);
}

// Keep track of positions for each cubelet
// Indices represent the original position (0,1,2 corresponds to -1,0,1)
// Elements are vec4s that represent the new coordinates (after rotations)
var cubeletPosition = new Array();
for (var ix = -1; ix <= 1; ix++) {
    var tempArrX = new Array();
    for (var iy = -1; iy <= 1; iy++) {
        var tempArrY = new Array();
        for (var iz = -1; iz <= 1; iz++) {
            tempArrY.push(vec4(ix,iy,iz,1));
        }
        tempArrX.push(tempArrY);
    }
    cubeletPosition.push(tempArrX);
}

// Keep track of cubelet transformation matrices, incremental turns
// Indices represent the original position (before rotations, since this is the matrix to get to the position post rotation)
// This is sent to the vertex shader
// Once a full turn has been made, values are rounded up and used to transform the positions matrix
var cubeletMatrix = new Array();
for (var ix = -1; ix <= 1; ix++) {
    var tempArrX = new Array();
    for (var iy = -1; iy <= 1; iy++) {
        var tempArrY = new Array();
        for (var iz = -1; iz <= 1; iz++) {
            tempArrY.push(mat4());
        }
        tempArrX.push(tempArrY);
    }
    cubeletMatrix.push(tempArrX);
}

// Keep track of each cubelet's orientation
// Used for checking if cube is solved (if orientations are all the same)
// Each orientation consists of 2 vectors indicating the normals of two orthogonal faces of the cube
// since 2 orthogonal faces determine the other faces
// Initial orientation is all the same, at (1,0,0), (0,1,0)
var cubeletOrientation = new Array();
for (var ix = -1; ix <= 1; ix++) {
    var tempArrX = new Array();
    for (var iy = -1; iy <= 1; iy++) {
        var tempArrY = new Array();
        for (var iz = -1; iz <= 1; iz++) {
            var tempArrZ = new Array();
            tempArrZ.push(vec4(1,0,0,0)); // last element is 0 since vector, not point
            tempArrZ.push(vec4(0,1,0,0));
            tempArrY.push(tempArrZ);
        }
        tempArrX.push(tempArrY);
    }
    cubeletOrientation.push(tempArrX);
}

// Globals for transformation matrices
var worldViewMatrix = mat4();
var projectionMatrix;
var modelViewMatrix;

// Locks the transformation matrices to pass to vertex shader
var worldViewMatrixLoc;
var projectionMatrixLoc;
var modelViewMatrixLoc;

// For randomize function, stores how many steps to randomize
var randomStepCount;

// For text file (save state) generation, needs to be global
// so previous file can be revoked otherwise there is a memory leak
var textFile = null;

// For loading in a file
var isFileLoaded = false; // checks if user has loaded a file
var fileContents; // contains the actual contents of the file to be loaded into cubeletPosition

// Helper function that indicates if cube is currently rotating
// If it is rotating, button presses don't do anything
function isRotating() {
    return (rotationAngle < 90);
}

// Init function
window.onload = function init()
{
    canvas = document.getElementById( "gl-canvas" );

    // Set up WebGL
    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 0.5, 0.6, 0.75 ); //gray
    //gl.clearColor( 1.0, 1.0, 1.0, 1.0 ); //white

    gl.enable(gl.DEPTH_TEST);

    // Generate Rubik's cube
    cubelet(vertexPos);
    genColors();

    // Load shaders and initialize attribute buffers
    program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    // Set up uniforms
    worldViewMatrixLoc = gl.getUniformLocation(program, "worldViewMatrix");
    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");

    // Event listeners for mouse

    var startX, startY;

    canvas.addEventListener("mousedown", function(e) {
        heldDown = true;
        // Keep track of starting x and y positions
        startX = e.pageX;
        startY = e.pageY;
        //dTHETA = dPHI = 0;
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
        PHI = (PHI-dPHI)%(2*Math.PI);

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

    // Event listeners for rotation buttons
    document.getElementById( "rightButton" ).onclick = function () {
        enqueueRotation('right', -1);
    };
    document.getElementById( "leftButton" ).onclick = function () {
        enqueueRotation('left', -1);
    };
    document.getElementById( "topButton" ).onclick = function () {
        enqueueRotation('top', -1);
    };
    document.getElementById( "bottomButton" ).onclick = function () {
        enqueueRotation('bottom', -1);
    };
    document.getElementById( "frontButton" ).onclick = function () {
        enqueueRotation('front', -1);
    };
    document.getElementById( "backButton" ).onclick = function () {
        enqueueRotation('back', -1);
    };
    document.getElementById( "rightButtonRev" ).onclick = function () {
        enqueueRotation('right', 1);
    };
    document.getElementById( "leftButtonRev" ).onclick = function () {
        enqueueRotation('left', 1);
    };
    document.getElementById( "topButtonRev" ).onclick = function () {
        enqueueRotation('top', 1);
    };
    document.getElementById( "bottomButtonRev" ).onclick = function () {
        enqueueRotation('bottom', 1);
    };
    document.getElementById( "frontButtonRev" ).onclick = function () {
        enqueueRotation('front', 1);
    };
    document.getElementById( "backButtonRev" ).onclick = function () {
        enqueueRotation('back', 1);
    };

    // Event listeners for keys (for rotation)
    document.onkeydown = function(e) {
        switch (e.keyCode) {
            case 39: // right arrow, rotates right face
                enqueueRotation('right', -1*(e.shiftKey ? -1 : 1));
                e.preventDefault();
                break;

            case 37: // left arrow, rotates left face
                enqueueRotation('left', -1*(e.shiftKey ? -1 : 1));
                e.preventDefault();
                break;

            case 38: // up arrow, rotates top face
                enqueueRotation('top',-1*(e.shiftKey ? -1 : 1));
                e.preventDefault();
                break;

            case 40: // down arrow, rotates bottom face
                enqueueRotation('bottom',-1*(e.shiftKey ? -1 : 1));
                e.preventDefault();
                break;

            case 90: // Z, rotates front face
                enqueueRotation('front',-1*(e.shiftKey ? -1 : 1));
                e.preventDefault();
                break;

            case 88: // X, rotates back face
                enqueueRotation('back',-1*(e.shiftKey ? -1 : 1));
                e.preventDefault();
                break;
        }
    }

    // Event listener for slider for rotation speed
    document.getElementById("speedSlider").onchange = function(e) {
        // Maps slider values to actual values
        rotationSpeedTemp = parseInt(e.target.value);
        switch(rotationSpeedTemp) {
            case 1:
                rotationSpeedTemp = 1;
                break;
            case 2:
                rotationSpeedTemp = 2;
                break;
            case 3:
                rotationSpeedTemp = 3;
                break;
            case 4:
                rotationSpeedTemp = 5;
                break;
            case 5:
                rotationSpeedTemp = 6;
                break;
            case 6:
                rotationSpeedTemp = 15;
                break;
            case 7:
                rotationSpeedTemp = 18;
                break;
            case 8:
                rotationSpeedTemp = 30;
                break;
            case 9:
                rotationSpeedTemp = 45;
                break;
            case 10:
                rotationSpeedTemp = 90;
                break;
        }
    };

    // Event listeners for buttons for other functionalities

    document.getElementById("resetButton").onclick = function(e) {
        if (!isRotating()) {
            resetState();
            //displaySolved(); // need to redo this upon loading
        }
        // Reset the state upon button press
        function resetState() {
            // Reset the cubelet positions to starting
            // Reset the cubelet matrices back to identity matrices
            for (var ix = -1; ix <= 1; ix++) {
                for (var iy = -1; iy <= 1; iy++) {
                    for (var iz = -1; iz <= 1; iz++) {
                        cubeletPosition[ix+1][iy+1][iz+1] = vec4(ix,iy,iz,1); // need this?
                        cubeletMatrix[ix+1][iy+1][iz+1] = mat4();
                        cubeletOrientation[ix+1][iy+1][iz+1][0] = vec4(1,0,0,0);
                        cubeletOrientation[ix+1][iy+1][iz+1][1] = vec4(0,1,0,0);
                    }
                }
            }
        }
    };

    document.getElementById("saveButton").onclick = function (e) {
        var link = document.getElementById("downloadLink");
        // For a less complicated save state, just use cubeletMatrix
        // since cubeletPosition and cubeletOrientation can both be computed from that
        // I'm lazy so I'll just store everything for now
        link.href = makeTextFile(JSON.stringify([cubeletPosition,cubeletMatrix,cubeletOrientation]));
        function makeTextFile(text) {
            var data = new Blob([text], {type: 'text/plain'});
            // If we are replacing a previously generated file we need to
            // manually revoke the object URL to avoid memory leaks.
            if (textFile !== null) {
              window.URL.revokeObjectURL(textFile);
            }
            textFile = window.URL.createObjectURL(data);
            return textFile;
        }
    };

    document.getElementById('fileUploadButton').addEventListener('change', function(e) {
        var file = e.target.files[0]; // FileList object, take only one file
        var reader = new FileReader(); // Crete file reader to interpret file
        // Change the file load event handler, i.e. what to do upon successful file loading
        reader.onload = function(e) {
            //console.log(e.target.result)
            fileContents = JSON.parse(reader.result); // parse JSON text and store into array
            var x, y, z, pos, mat, orient;
            for (x = 0; x < 3; x++) {
                for (y = 0; y < 3; y++) {
                    for (z = 0; z < 3; z++) {
                        pos = fileContents[0][x][y][z]; // element of cubeletPosition
                        mat = fileContents[1][x][y][z]; // element of cubeletMatrix
                        orient = fileContents[2][x][y][z];
                        // Remap each element into a vec4/mat4
                        fileContents[0][x][y][z] = vec4(pos[0], pos[1], pos[2], pos[3]);
                        fileContents[1][x][y][z] = mat4(mat[0][0], mat[0][1], mat[0][2], mat[0][3],
                                                        mat[1][0], mat[1][1], mat[1][2], mat[1][3],
                                                        mat[2][0], mat[2][1], mat[2][2], mat[2][3],
                                                        mat[3][0], mat[3][1], mat[3][2], mat[3][3]);
                        fileContents[2][x][y][z][0] = vec4(orient[0][0], orient[0][1], orient[0][2], orient[0][3]);
                        fileContents[2][x][y][z][1] = vec4(orient[1][0], orient[1][1], orient[1][2], orient[1][3]);
                        //console.log("HUH",fileContents[0][x][y][z], fileContents[1][x][y][z]. fileContents[2][x][y][z][0],fileContents[2][x][y][z][1])
                    }
                }
            }
            isFileLoaded = true;
        };
        // Finally read the file as a text string
        reader.readAsText(file);
    });

    // Make sure to reset the value so that whenever you click the choose file button
    // the file gets reset (and if you cancel, isFileLoaded will stay false)
    document.getElementById('fileUploadButton').onclick = function() {
        this.value = null;
        isFileLoaded = false;
    }

    document.getElementById("loadButton").onclick = function () {
        if (!isFileLoaded) {
            alert("Please select a cube state file.");
        } else {
            // Create a shallow copy of the file contents and store it in the cubeletMatrix array
            // Now the loaded state should appear
            cubeletPosition = fileContents[0].slice();
            cubeletMatrix = fileContents[1].slice();
            cubeletOrientation = fileContents[2].slice();
        }
    };

    document.getElementById("randomButton").onclick = function(e) {
        randomizeCube();
    }

    render();
}

// Function that generates a cubelet using quad
// Need to specify center of cube
function cubelet(v)
{
    quad( 2, 3, 7, 6, v); // right face
    quad( 5, 4, 0, 1, v); // left face
    quad( 6, 5, 1, 2, v); // top face
    quad( 3, 0, 4, 7, v); // bottom face
    quad( 1, 0, 3, 2, v); // front face
    quad( 4, 5, 6, 7, v); // back face
}

// Function that generates a quad (face) of one cubelet
// Need to specify the center of the cube (x, y, z)
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

    // 6 vertices determine a face in a quad (2 triangles)
    var indices = [ a, b, c, a, c, d ];
    for ( var i = 0; i < indices.length; ++i ) {
        // Push the vertices into the vertex array
        points.push( vertices[indices[i]] );
    }
}

// Function that generates colors for the entire cube
function genColors()
{
    var x, y, z;
    for (x = -1; x <= 1; x++) {
        for (y = -1; y <= 1; y++) {
            for (z = -1; z <= 1; z++) {
                genColorsFace(2, 3, 7, 6, x, y, z); // right face
                genColorsFace(5, 4, 0, 1, x, y, z); // left face
                genColorsFace(6, 5, 1, 2, x, y, z); // top face
                genColorsFace(3, 0, 4, 7, x, y, z); // bottom face
                genColorsFace(1, 0, 3, 2, x, y, z); // front face
                genColorsFace(4, 5, 6, 7, x, y, z); // back face
            }
        }
    }

    // Generates the colors for a face
    // Also colors insides black
    function genColorsFace(a, b, c, d, x, y, z) {

        var vertexColors = [
            vec4( 0.0, 0.0, 0.0, 1.0 ), // black (inside), index 0
            vec4( 0.0, 1.0, 0.0, 1.0 ), // green (front), index 1
            vec4( 1.0, 0.0, 0.0, 1.0 ), // red (right), index 2
            vec4( 1.0, 1.0, 0.0, 1.0 ), // bottom (yellow), index 3
            vec4( 0.0, 0.0, 1.0, 1.0 ), // blue (back), index 4
            vec4( 1.0, 0.5, 0.0, 1.0 ), // orange (left), index 5
            vec4( 1.0, 1.0, 1.0, 1.0 ) // white (top), index 6
        ];

        // Booleans that indicate what side of the whole Rubick's cube this quad is on
        var rightRubix = (x == 1);
        var leftRubix = (x == -1);
        var topRubix = (y == 1);
        var bottomRubix = (y == -1);
        var frontRubix = (z == 1);
        var backRubix = (z == -1);

        // Booleans that indicate what face of the cublet this quad is on
        var rightCublet = (a == 2);
        var leftCublet = (a == 5);
        var topCublet = (a == 6);
        var bottomCublet = (a == 3);
        var frontCublet = (a == 1);
        var backCublet = (a == 4);

        // Booleans that indicate the face of this quad
        var right = rightRubix && rightCublet;
        var left = leftRubix && leftCublet;
        var top = topRubix && topCublet;
        var bottom = bottomRubix && bottomCublet;
        var front = frontRubix && frontCublet;
        var back = backRubix && backCublet;

        var indices = [ a, b, c, a, c, d ];
        for ( var i = 0; i < indices.length; ++i ) {
            //colors.push( vertexColors[a] ); // DEBUG, comment the rest of the loop out
            if (right || left || top || bottom || front || back) {
                colors.push( vertexColors[a] );
            } else {
                colors.push( vertexColors[0] );
            }  
        }
    }
}

// Push rotation onto rotation queue
function enqueueRotation(face, direction) {
    var axis;
    switch(face) {
        case 'right':
            axis = xAxis;
            break;
        case 'left':
            axis = xAxis;
            break;
        case 'top':
            axis = yAxis;
            break;
        case 'bottom':
            axis = yAxis;
            break;
        case 'front':
            axis = zAxis;
            break;
        case 'back':
            axis = zAxis;
            break;
    }
    rotationQueue.push([face,direction,axis]);
    console.log("ENQUEUE", [face,direction,axis])

    // Want to try start a rotation as soon as you push one on
    dequeueRotation();
}

// Pop rotation from rotation queue
function dequeueRotation() {
    // If no rotations available or if a rotation is currently taking place, do nothing
    if (rotationQueue.length == 0 || isRotating()) {
        return;
    }
    // If a rotation is possible, pop off the rotation parameters
    var nextRotation = rotationQueue.shift();
    rotationFace = nextRotation[0];
    rotationDir = nextRotation[1];
    rotationAxis = nextRotation[2];
    console.log("DEQUEUE", [rotationFace,rotationDir,rotationAxis])
    // This triggers the render function to start drawing the rotation
    rotationAngle = 0;
    rotationSpeed = rotationSpeedTemp;
}

function render()
{
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Set the camera position at each render (spherical coordinates)
    eye = vec3(cameraRadius*Math.sin(PHI)*Math.sin(THETA),
            cameraRadius*Math.cos(PHI),
            cameraRadius*Math.sin(PHI)*Math.cos(THETA));

    // World view matrix (involves translates and rotates for each cubelet)
    // Initialize to identity matrix
    worldViewMatrix = mat4();

    // After releasing the mouse, want to produce a fading motion
    if (!heldDown) {
        dTHETA *= AMORTIZATION;
        dPHI *= AMORTIZATION
        if ((PHI > Math.PI && PHI < 2*Math.PI) || (PHI < 0 && PHI > -Math.PI)) {
            up = vec3(0.0, -1.0, 0.0);
            THETA = (THETA+dTHETA)%(2*Math.PI);
        } else {
            up = vec3(0.0, 1.0, 0.0);
            THETA = (THETA-dTHETA)%(2*Math.PI);
        }
        PHI = (PHI-dPHI)%(2*Math.PI);
    }
    
    // Model-view matrix
    modelViewMatrix = mat4();
    modelViewMatrix = mult(lookAt(eye, at, up), modelViewMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));

    // Projection matrix
    projectionMatrix = perspective(fovy, aspect, near, far);
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

    var i = 0; // used to partition color array into cubes to generate the right colors
    var x, y, z; // starting positions
    var curX, curY, curZ, curPos; // current positions

    // Render each cube individually for rotations
    for (x = -1; x <= 1; x++) {
        for (y = -1; y <= 1; y++) {
            for (z = -1; z <= 1; z++) {

                // Translate cubelet to its proper place
                worldViewMatrix = mult(translate(x*spacing,y*spacing,z*spacing), worldViewMatrix);

                // Easier on eyes
                curPos = cubeletPosition[x+1][y+1][z+1];
                curX = curPos[0];
                curY = curPos[1];
                curZ = curPos[2];

                // Check if rotation is occurring
                // Want to only rotate for one turn, i.e. 90 degrees
                if (isRotating()) {

                    // Velocity includes speed and direction
                    var rotationVelocity = rotationDir*rotationSpeed;

                    var isRotatingCublet = false; // indicates that this cublet is being rotated, introduced to cut down repeated code

                    // We check the current positions, not the starting ones
                    if ((rotationFace == 'right' && curX == 1) || (rotationFace == 'left' && curX == -1)) {
                        // Incremental rotation, modify the cumulative matrix
                        cubeletMatrix[x+1][y+1][z+1] = mult(rotateX(rotationVelocity), cubeletMatrix[x+1][y+1][z+1]);
                        isRotatingCublet = true;
                    }

                    else if ((rotationFace == 'top' && curY == 1) || (rotationFace == 'bottom' && curY == -1)) {
                        cubeletMatrix[x+1][y+1][z+1] = mult(rotateY(rotationVelocity), cubeletMatrix[x+1][y+1][z+1]);
                        isRotatingCublet = true;
                    }

                    else if ((rotationFace == 'front' && curZ == 1) || (rotationFace == 'back' && curZ == -1)) {
                        cubeletMatrix[x+1][y+1][z+1] = mult(rotateZ(rotationVelocity), cubeletMatrix[x+1][y+1][z+1]);
                        isRotatingCublet = true;
                    }

                    if (isRotatingCublet) {

                        // Keep track of when angle reaches 90
                        thetaCubelet[curX+1][curY+1][curZ+1][rotationAxis] += rotationVelocity;

                        // If angle reached 90, a full turn is made, so record the new positions
                        if (Math.abs(thetaCubelet[curX+1][curY+1][curZ+1][rotationAxis]) >= 90.0) {
                            // Get the new cubelet position by multiplying the CUMULATIVE matrix to the ORIGINAL position
                            cubeletPosition[x+1][y+1][z+1] = mult(cubeletMatrix[x+1][y+1][z+1], vec4(x,y,z,1));
                            // Get the new cubelet orientation
                            cubeletOrientation[x+1][y+1][z+1][0] = mult(cubeletMatrix[x+1][y+1][z+1], vec4(1,0,0,0));
                            cubeletOrientation[x+1][y+1][z+1][1] = mult(cubeletMatrix[x+1][y+1][z+1], vec4(0,1,0,0));
                            // Round the elements in the positions matrix once a full turn has been reached
                            // Also round the elements in the rotation matrix, which is either 0, 1, or -1 (sin and cos of +-90)
                            // Added rounding orientations
                            for (var j = 0; j < 3; j++) {
                                cubeletPosition[x+1][y+1][z+1][j] = Math.round(cubeletPosition[x+1][y+1][z+1][j]);
                                for (var jj = 0; jj < 3; jj++) {
                                    cubeletMatrix[x+1][y+1][z+1][j][jj] = Math.round(cubeletMatrix[x+1][y+1][z+1][j][jj]);
                                }
                                cubeletOrientation[x+1][y+1][z+1][0][j] = Math.round(cubeletOrientation[x+1][y+1][z+1][0][j]);
                                cubeletOrientation[x+1][y+1][z+1][1][j] = Math.round(cubeletOrientation[x+1][y+1][z+1][1][j]);
                            }
                            thetaCubelet[curX+1][curY+1][curZ+1][rotationAxis] = 0;
                        }
                    }
                }

                // Now modify the world-view matrix to account for this additional cubelet rotation
                worldViewMatrix = mult(cubeletMatrix[x+1][y+1][z+1], worldViewMatrix);
                gl.uniformMatrix4fv(worldViewMatrixLoc, false, flatten(worldViewMatrix));

                // Color array attribute buffer
                var cBuffer = gl.createBuffer();
                gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
                gl.bufferData( gl.ARRAY_BUFFER, flatten(colors.slice(i*NumVertices,(i+1)*NumVertices)), gl.STATIC_DRAW );

                var vColor = gl.getAttribLocation( program, "vColor" );
                gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0 , 0);
                gl.enableVertexAttribArray(vColor);

                // Vertex array attribute buffer
                var vBuffer = gl.createBuffer();
                gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer );
                gl.bufferData( gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW );

                var vPosition = gl.getAttribLocation( program, "vPosition" );
                gl.vertexAttribPointer( vPosition, 4, gl.FLOAT, false, 0, 0 );
                gl.enableVertexAttribArray( vPosition );

                // Draw out the vertices
                gl.drawArrays( gl.TRIANGLES, 0, NumVertices );

                worldViewMatrix = mat4();

                i += 1;
            }
        }
    }

    // Increment rotation angle after all the desired cubelets have been rotated
    // Want to only rotate for one turn, i.e. 90 degrees
    if (isRotating()) {
        rotationAngle += rotationSpeed;
        // Now check if full turn has been reached, if so then dequeue the next rotation
        // This will continue to dequeue until the queue is empty
        if (!isRotating()) {
            dequeueRotation();
           
        }
    } else {
        // If in stationary state, check if Rubik's cube is solved
        displaySolved();
    }

    requestAnimFrame( render );
}

// Randomize the cube for a certain amount of rotate steps, makes use of setInterval
// Customizable delay for different rotation speeds
// Could also use a queue in the render function
function randomizeCube() {

    // Get the total number of steps
    var steps = document.getElementById("randomStepCount").value;

    // Check is input is valid
    if(isNaN(steps) || steps == 0) {
        return;
    }

    // Randomize button; want to disable it when randomize is still occuring
    var btn = document.getElementById("randomButton");
    btn.disabled = true;
    
    for (var i = 0; i < steps; i++) {
        randomizedRotate();
    }

    // Enable button once randomize is done
    btn.disabled = false;

    // Rotate a random face of the cube in a random direction
    function randomizedRotate() {

        var faces = ['right','left','top','bottom','front','back'];
        var directions = [-1, 1];

        // Pick a random index from each of the above arrays
        var randFace = faces[Math.floor(Math.random()*faces.length)];
        var randDir = directions[Math.floor(Math.random()*directions.length)];
        enqueueRotation(randFace, randDir);
    }
}

// Checks if arrays are equal
function isArrayEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length != b.length) return false;

    for (var i = 0; i < a.length; ++i) {
        if (a[i] != b[i]) return false;
    }
    return true;
}

// Checks if orientations are equal
function isOrientationEqual(face1, face2) {
    return (isArrayEqual(face1[0],face2[0]) && isArrayEqual(face1[1],face2[1]));
}

// Checks if Rubix cube is solved
function isSolved() {
    var reference = cubeletOrientation[0][0][0];
    return (
            isOrientationEqual(cubeletOrientation[0][0][1], reference) &&
            isOrientationEqual(cubeletOrientation[0][0][2], reference) &&
            isOrientationEqual(cubeletOrientation[0][1][0], reference) &&
            isOrientationEqual(cubeletOrientation[0][1][1], reference) &&
            isOrientationEqual(cubeletOrientation[0][1][2], reference) &&
            isOrientationEqual(cubeletOrientation[0][2][0], reference) &&
            isOrientationEqual(cubeletOrientation[0][2][1], reference) &&
            isOrientationEqual(cubeletOrientation[0][2][2], reference) &&

            isOrientationEqual(cubeletOrientation[1][0][0], reference) &&
            isOrientationEqual(cubeletOrientation[1][0][1], reference) &&
            isOrientationEqual(cubeletOrientation[1][0][2], reference) &&
            isOrientationEqual(cubeletOrientation[1][1][0], reference) &&
            isOrientationEqual(cubeletOrientation[1][1][1], reference) &&
            isOrientationEqual(cubeletOrientation[1][1][2], reference) &&
            isOrientationEqual(cubeletOrientation[1][2][0], reference) &&
            isOrientationEqual(cubeletOrientation[1][2][1], reference) &&
            isOrientationEqual(cubeletOrientation[1][2][2], reference) &&

            isOrientationEqual(cubeletOrientation[2][0][0], reference) &&
            isOrientationEqual(cubeletOrientation[2][0][1], reference) &&
            isOrientationEqual(cubeletOrientation[2][0][2], reference) &&
            isOrientationEqual(cubeletOrientation[2][1][0], reference) &&
            isOrientationEqual(cubeletOrientation[2][1][1], reference) &&
            isOrientationEqual(cubeletOrientation[2][1][2], reference) &&
            isOrientationEqual(cubeletOrientation[2][2][0], reference) &&
            isOrientationEqual(cubeletOrientation[2][2][1], reference) &&
            isOrientationEqual(cubeletOrientation[2][2][2], reference)
            );
}

// Checks if Rubik's cube is solved and displays appropriate message
function displaySolved() {
    if (isSolved()) {
      document.getElementById("solvedMessage").innerHTML = "Solved: YES";
    } else {
      document.getElementById("solvedMessage").innerHTML = "Solved: NO";
    }
}

*/