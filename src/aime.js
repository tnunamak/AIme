// create an new instance of a pixi stage
var stage = new PIXI.Stage(0x66FF99);

var w = window,
    d = document,
    e = d.documentElement,
    g = d.getElementsByTagName('body')[0],
    width = w.innerWidth || e.clientWidth || g.clientWidth,
    height = w.innerHeight || e.clientHeight || g.clientHeight;

var POSITIONAL_ERROR = 0.5,
    HEALTH_BAR_INDEX = 0,
    LABEL_INDEX = 1,
    HEALTH_BAR_WIDTH = 30,
    HEALTH_BAR_HEIGHT = HEALTH_BAR_WIDTH / 8,
    HEALTH_BAR_OUTLINE_WIDTH = 1,//0,//HEALTH_BAR_HEIGHT / 2.5,
    BASE_MAX_HEALTH = 5000,
    MAX_DAMAGE = 50,
    MAX_HEALING = 50,
    SPAWN_COOLDOWN_MS = 10000,
    ATTACK_COOLDOWN_MS = 500,
    HEAL_COOLDOWN_MS = 500,
    MELEE_RANGE = 30.0,
    ATTACK_RANGE = 50.0,
    MOVEMENT_SPEED = 1,
    CLOSE_DISTANCE = Math.min(width, height) * 0.05,
    LOW_HEALTH = 100,
    HIGH_HEALTH = 500;

var framerate = 60;

// create a renderer instance.
var renderer = PIXI.autoDetectRenderer(width, height);

// add the renderer view element to the DOM
document.body.appendChild(renderer.view);

requestAnimFrame(animate);

var teamCharacterTextures = [
    ['images/bunny.png', 'images/bunny2.png', 'images/bunny3.png'],
    ['images/monkey.png']
];

var DEAD_CHARACTER_TEXTURE = PIXI.Texture.fromImage("images/bones.png");
var DEAD_TOWER_TEXTURE = PIXI.Texture.fromImage("images/rubble.png");

var game = {};

bootstrap();

function bootstrap() {
    game.actors = [];
    game.teams = [];
    game.obstacles = [];

    placeObstacles();
    createTeams(2, 1);
    //var sound = new Howl({  urls: ['sounds/fishy.mp3'], autoplay: true, loop: true}).play();
}

function placeObstacles() {
    for(var i = 0; i < Math.random() * 10; i++) {
        var w = Math.random() * (1/10) * width,
            h = Math.random() * (1/10) * height;

        var x = Math.random() * width,
            y = Math.random() * height;

        var obstacle = new PIXI.Graphics();
        obstacle.lineStyle(HEALTH_BAR_OUTLINE_WIDTH, 0x000000);
        obstacle.drawRect(x, y, w, h);

        stage.addChild(obstacle);
        game.obstacles.push(obstacle);
    }
}

function createTeams(numTeams, actorsPerTeam) {
    _.each(_.range(numTeams), function(index) {
        game.teams.push(createTeam());
        createActors(index, actorsPerTeam);
    });
}

function createTeam() {
    var sprite = new PIXI.Sprite(PIXI.Texture.fromImage('images/tower.png'));

    sprite.scale = new PIXI.Point(.25, .25);

    sprite.addChildAt(createHealthBar(), HEALTH_BAR_INDEX);

    placeSpriteAt(sprite, Math.random() * width, Math.random() * height);

    return {
        base: _.extend(sprite, {
            data: {
                stats: {
                    maxHealth: BASE_MAX_HEALTH
                },
                state: {
                    health: 1,
                    color: getRandomColor()
                }
            }
        })
    };
}

function buildAnimatedCharacter(images) {
    return new PIXI.MovieClip(_.map(images, function (image) {
        return PIXI.Texture.fromImage(image);
    }));
}

function createBunny(teamIndex) {
    //var bunny = new PIXI.MovieClip(teamCharacterTextures[teamIndex]);

    var bunny = buildAnimatedCharacter(teamCharacterTextures[teamIndex]);
    bunny.animationSpeed = 0.1;
    //stage.addChild(animated);
    bunny.play();

    bunny.data = {
        stats: {
            intelligence: Math.random(),
            healing: Math.random(),
            defense: Math.random(),
            team: Math.random(),
            speed: (Math.random() * 0.7) + 0.3,
            strength: Math.random(),
            maxHealth: (Math.random() * (HIGH_HEALTH - LOW_HEALTH)) + LOW_HEALTH
        }
    };

    bunny.data.state = {
        health: 1,
        fortification: 0,
        team: game.teams[teamIndex]
    };

    var text = new PIXI.Text("", {font: "9px Georgia", fill: "black"});

    bunny.addChildAt(createHealthBar(), HEALTH_BAR_INDEX);

    text.anchor.x = 0.5;
    text.anchor.y = -1.3;
    bunny.addChildAt(text, LABEL_INDEX);

    bunny.anchor.x = 0.5;
    bunny.anchor.y = 0.5;
    return bunny;
}

function isOccupied(location) {
    return _.some(game.actors, function(actor) {
        return equivalentLocations(actor.position, location);
    }) || _.some(game.obstacles, function(obstacle) {
        var bounds = obstacle.getBounds();
        return bounds.x <= location.x && location.x <= (bounds.x + bounds.width)
            && bounds.y <= location.y && location.y <= (bounds.y + bounds.height);
    });
}

function getSiblingCoordinates(start, edgeWidth) {
    var siblings = [
        {
            x: start.x + edgeWidth,
            y: start.y +  edgeWidth
        },
        {
            x: start.x - edgeWidth,
            y: start.y +  edgeWidth
        },
        {
            x: start.x + edgeWidth,
            y: start.y -  edgeWidth
        },
        {
            x: start.x - edgeWidth,
            y: start.y - edgeWidth
        },
        {
            x: start.x,
            y: start.y +  edgeWidth
        },
        {
            x: start.x,
            y: start.y -  edgeWidth
        },
        {
            x: start.x + edgeWidth,
            y: start.y
        },
        {
            x: start.x - edgeWidth,
            y: start.y
        }];

    return _.filter(siblings, isWithinStageBounds);

}

function findPath(start, end) {
    return findPathHelper(start, end, [], [start]);
}

function containsLocation(list, location) {
    return _.some(list, function(other) {
        return equivalentLocations(location, other);
    });
}

function equivalentLocations(a, b) {
    return withinErrorOf(POSITIONAL_ERROR, a.x, b.x) && withinErrorOf(POSITIONAL_ERROR, a.y, b.y);
}

function findPathHelper(start, end, visited, memo) {
    //var numPixels = 250000;
    //var stageArea = width * height;
    var edgeWidth = POSITIONAL_ERROR;
    
    if(equivalentLocations(start, end)) {
        return memo;
    }

    visited.push(start);

    var activeSiblings = _.filter(getSiblingCoordinates(start, edgeWidth), function(location) {
        return !containsLocation(visited, location);
    });

    var siblingCoordinates = _.sortBy(activeSiblings, _.partial(distanceSquared, end));

    var shortestPath;

    _.each(siblingCoordinates, function(location) {
        if(shortestPath) {
            return;
        }
        if(isOccupied(location)) {
            return null;
        } else {
            var path = _.clone(memo);
            path.push(location);
            
            var pathFromSibling = findPathHelper(location, end, visited, path);
            if(pathFromSibling != null) {
                shortestPath = pathFromSibling;
            }
        }
    });

    return shortestPath;
}

function fillHealthBar(healthBar, health) {
    health = _.isUndefined(health) ? 1 : health;
    healthBar.clear();
    healthBar.beginFill(0x00FF00);
    healthBar.lineStyle(HEALTH_BAR_OUTLINE_WIDTH, 0x000000);
    healthBar.drawRect(-(HEALTH_BAR_WIDTH / 2), -25, HEALTH_BAR_WIDTH * health, HEALTH_BAR_HEIGHT);
    healthBar.beginFill(0xFF0000);
    healthBar.drawRect(-(HEALTH_BAR_WIDTH / 2) + HEALTH_BAR_WIDTH * health, -25, HEALTH_BAR_WIDTH * (1 - health), HEALTH_BAR_HEIGHT);
}

function createHealthBar() {
    var healthBar = new PIXI.Graphics();
    fillHealthBar(healthBar);
    return healthBar;
}

function createActors(teamIndex, actorsPerTeam) {
    for (var i = 0; i < actorsPerTeam; i++) {
        var bunny = createBunny(teamIndex);

        var x = game.teams[teamIndex].base.position.x + getRandomValueCenteredAtZero(100);
        var y = game.teams[teamIndex].base.position.y + getRandomValueCenteredAtZero(100);

        placeSpriteAt(bunny, x, y);
        game.actors.push(bunny);
    }
}

function placeSpriteAt(sprite, x, y) {
    sprite.position.x = x;
    sprite.position.y = y;

    stage.addChild(sprite);
}

function getRandomColor() {
    return parseInt(Math.random() * 0xFFFFFF << 0, 16);
}

function getLabel(sprite) {
    return sprite.getChildAt(LABEL_INDEX);
}

function animateActor(sprite) {
    var bounceRadius = .1;
    var bounceDurationSec = 1;
    var updateRate = 60 / 60;

    if (Math.random() < updateRate) {

        var bounceAmount = bounceRadius / ( framerate * bounceDurationSec) / updateRate;

        var bounceDirection = sprite.data.lastAnchor ? signOf(sprite.anchor.y - sprite.data.lastAnchor.y) : 1;

        if (Math.abs(sprite.anchor.y) > bounceRadius) {
            bounceDirection *= -1;
        }

        sprite.data.lastAnchor = _.clone(sprite.anchor);

        sprite.anchor.y += bounceAmount * bounceDirection;

    }
}

function animate() {
    requestAnimFrame(animate);

    _.each(game.teams, function (team) {
        drawHealth(team.base, team.base.data.state.health);
    });

    _.each(game.actors, function (bunny) {
        drawHealth(bunny, bunny.data.state.health);
        act(bunny);
        animateActor(bunny);
    });

    // render the stage
    renderer.render(stage);
}

function drawHealth(object, health) {
    fillHealthBar(object.getChildAt(HEALTH_BAR_INDEX), health);
}

function act(sprite) {
    var currentObjective = sprite.data && sprite.data.objective;
    perform(sprite, currentObjective || getNewObjective(sprite));
}

function clearObjective(sprite) {
    delete sprite.data.objective;
}

function mean() {
    return _.reduce(arguments, function (a, b) {
        return a + b
    }, 0) / arguments.length;
}

function closestMeetsCondition(sprite, listOfSprites, condition) {
    var closestDistance;
    var closest;
    _.each(listOfSprites, function (item) {
        if (condition(sprite, item)) {
            var dist = distance(sprite.position, item.position);
            if (_.isUndefined(closestDistance) || dist < closestDistance) {
                closestDistance = dist;
                closest = item;
            }
        }
    });
    return closest;
}

function closestEnemy(sprite) {
    return closestMeetsCondition(sprite, game.actors, function (subject, other) {
        return subject.data.state.team != other.data.state.team && other.data.state.health > 0;
    });
}

function closestEnemyTower(sprite) {
    var enemyTowers = _.map(game.teams, function (team) {
        return team.base;
    });

    return closestMeetsCondition(sprite, enemyTowers, function (subject, other) {
        return subject.data.state.team.base != other && other.data.state.health > 0;
    });
}

function closestAlly(sprite) {
    return closestMeetsCondition(sprite, game.actors, function (subject, other) {
        return subject != other && subject.data.state.team === other.data.state.team && other.data.state.health > 0;
    });
}

function chooseAttackTarget(sprite) {
    return closestEnemy(sprite) || closestEnemyTower(sprite);
}

var goals = [
    {
        id: 'be_dead',
        score: function (sprite) {
            return (sprite.data.state.health === 0) ? 1.1 : 0;
        }
    },
    {
        id: 'attack',
        score: function (sprite) {
            var target = chooseAttackTarget(sprite);

            if (_.isUndefined(target)) {
                return 0;
            }
            var closeness = Math.min(1, CLOSE_DISTANCE / distance(sprite.position, target.position));
            return mean(closeness,
                sprite.data.stats.strength,
                Math.min(1, (sprite.data.state.health * sprite.data.stats.maxHealth) / LOW_HEALTH));
        }
    },
    {
        id: 'heal',
        score: function (sprite) {
            return 1 - sprite.data.state.health;
        }
    },
    {
        id: 'squad_up',
        score: function (sprite) {
            return 0;//sprite.data.stats.team;
        }
    },
    {
        id: 'explore',
        score: function (sprite) {
            return sprite.data.stats.speed;
        }
    },
    {
        id: 'spy',
        score: function (sprite) {
            return 0;//sprite.data.stats.intelligence;
        }
    },
    {
        id: 'fortify',
        score: function (sprite) {
            return 0;//Math.random();
        }
    }
];

function getNewObjective(sprite) {

    var winningScore = -1;
    var winner = goals[0];
    _.each(goals, function (goal) {
        var goalScore = goal.score(sprite);
        if (goalScore > winningScore) {
            winningScore = goalScore;
            winner = goal;
        }
    });

    var newObjective;

    switch (winner.id) {
        case 'attack':
            newObjective = { type: 'attack', data: {cooldownLength: ATTACK_COOLDOWN_MS, cooldownEndTime: Date.now() + ATTACK_COOLDOWN_MS} };
            break;
        case 'fortify':
            newObjective = { type: 'fortify', data: { endTime: Date.now() + Math.round(Math.random() * 7000) + 3000 } };
            break;
        case 'squad_up':
            var target = closestAlly(sprite);
            newObjective = { type: 'follow', data: {target: target} };
            break;
        case 'heal':
            newObjective = { type: 'heal', data: { target: sprite, cooldownLength: HEAL_COOLDOWN_MS, cooldownEndTime: Date.now() + HEAL_COOLDOWN_MS }};
            //newObjective = { type: 'spin', data: { rotateTo: (2 * Math.PI) }};
            break;
        case 'explore':
            var targetLocation = boundToStage({
                x: sprite.position.x + getRandomValueCenteredAtZero(width / 2),
                y: sprite.position.y + getRandomValueCenteredAtZero(height / 2)});

            var path = findPath(sprite.position, targetLocation);
            if(path) {
                newObjective = { type: 'move', data: { path: path, destination: targetLocation }};
            } else {
                console.log('no path');
                newObjective = { type: 'wait', data: { endTime: Date.now() + Math.round(Math.random() * 7000) + 3000 }}
            }
            break;
        case 'be_dead':
            newObjective = { type: 'be_dead', data: { endTime: Date.now() + SPAWN_COOLDOWN_MS }};
            break;
        default:
            newObjective = { type: 'wait', data: { endTime: Date.now() + Math.round(Math.random() * 7000) + 3000 }}

    }

    sprite.data.objective = newObjective;
    getLabel(sprite).setText(winner.id);// + ' (' + winningScore.toFixed(2) + ')');
    //getLabel(sprite).setText(newObjective.type);
    return newObjective;
}

function perform(sprite, objective) {

    switch (objective.type) {
        case 'attack':
            var target = chooseAttackTarget(sprite);
            if (_.isUndefined(target)) {
                clearObjective(sprite);
                return;
            }

            var distanceToTarget = distance(sprite.position, target.position);
            if (distanceToTarget < ATTACK_RANGE) {
                if (objective.data.cooldownEndTime < Date.now()) {
                    applyDamage(target, sprite.data.stats.strength * MAX_DAMAGE);
                    objective.data.cooldownEndTime = Date.now() + objective.data.cooldownLength;
                }
            } else {
                stepToward(sprite, target);
            }

            if (target.data.state.health === 0) {
                clearObjective(sprite);
            }

            break;
        case 'heal':
            if (objective.data.cooldownEndTime < Date.now()) {
                applyHeal(objective.data.target, sprite.data.stats.healing * MAX_HEALING);
                objective.data.cooldownEndTime = Date.now() + objective.data.cooldownLength;
            }

            if (objective.data.target.data.state.health === 1) {
                clearObjective(sprite);
            }
            break;
        case 'fortify':
            sprite.data.state.fortification = 1;

            if (objective.data.endTime < Date.now()) {
                sprite.data.state.fortification = 0;
                clearObjective(sprite);
            }
            break;
        case 'spin':
            sprite.rotation += ((2 * Math.PI) / 100);
            if (sprite.rotation > objective.data.rotateTo) {
                sprite.rotation = objective.data.rotateTo % (2 * Math.PI);
                objective.data.status = 'completed';
            }
            break;
        case 'move':


            if(withinErrorOf(POSITIONAL_ERROR, 0, distance(sprite.position, objective.data.path[0]))) {
                var nextTarget = objective.data.path.shift();
                stepToward(sprite, nextTarget);
            } else {
                stepToward(sprite, objective.data.path[0]);
            }

            if(objective.data.path.length === 0) {
                clearObjective(sprite);
            }

            /*stepToward(sprite, objective.data.destination);

            if (withinErrorOf(MELEE_RANGE, 0, distance(sprite.position, objective.data.destination))) {
                clearObjective(sprite);
            }*/
            break;
        case 'follow':
            stepToward(sprite, objective.data.path[0]);

            if (withinErrorOf(MELEE_RANGE, 0, distance(sprite.position, objective.data.target.position))) {
                clearObjective(sprite);
            }
            break;
        case 'wait':
            if (objective.data.endTime < Date.now()) {
                clearObjective(sprite);
            }
            break;
        case 'be_dead':
            if (objective.data.endTime < Date.now()) {
                revive(sprite);
                sprite.position.x = sprite.data.state.team.base.position.x + ((Math.random() * 30) - 15);
                sprite.position.y = sprite.data.state.team.base.position.y + ((Math.random() * 30) - 15);
                clearObjective(sprite);
            }
            break;

    }
}

function getRandomValueCenteredAtZero(magnitude) {
    return Math.random() * magnitude - (magnitude / 2);
}

function isWithinStageBounds(location) {
    return location.x >= 0 && location.x < width
            && location.y >= 0 && location.y < height;
}

function boundToStage(point) {
    var x = point.x, y = point.y, x_b, y_b;

    x_b = (x < 0) ? 0 : (x > width) ? width : x;
    y_b = (y < 0) ? 0 : (y > height) ? height : y;

    return {x: x_b, y: y_b};
}

function withinErrorOf(error, a, b) {
    return Math.abs(a - b) < error;
}

function isTower(sprite) {
    return _.some(game.teams, function(team) {
        return team.base === sprite;
    });
}

function die(sprite) {

    if(isTower(sprite)) {
        sprite.setTexture(DEAD_TOWER_TEXTURE);
        return;
    }

    clearObjective(sprite);
    sprite.data.trueTexture = sprite.texture;
    sprite.setTexture(DEAD_CHARACTER_TEXTURE);
    sprite.stop();
}

function revive(sprite) {
    console.log("reviving");
    sprite.data.state.health = 1;
    sprite.setTexture(sprite.data.trueTexture);
    //sprite.start();
}

function applyHeal(sprite, heal) {
    sprite.data.state.health = Math.min(1, sprite.data.state.health + (heal / sprite.data.stats.maxHealth));
}

function applyDamage(sprite, damage) {
    var trueDamage = damage * ((1 - (sprite.data.stats.defense || 0) ) + (1 - (sprite.data.state.fortification || 0))) / 2; // TODO does this computation make sense?
    sprite.data.state.health = Math.max(0, sprite.data.state.health - (trueDamage / sprite.data.stats.maxHealth));

    if (sprite.data.state.health === 0) {
        die(sprite);
    }
}

function stepToward(sprite, destination) {
    var dx = Math.abs(destination.x - sprite.position.x),
        dy = Math.abs(destination.y - sprite.position.y);

    var direction = (dx === 0) ? signOf(dy) : Math.atan(dy / dx);

    var xSpeed = sprite.data.stats.speed * Math.cos(direction) * MOVEMENT_SPEED;
    var ySpeed = sprite.data.stats.speed * Math.sin(direction) * MOVEMENT_SPEED;

    sprite.position.x += //withinErrorOf(POSITIONAL_ERROR, sprite.position.x, destination.x) ? 0 :
        signOf(destination.x - sprite.position.x) * xSpeed;
    sprite.position.y += //withinErrorOf(POSITIONAL_ERROR, sprite.position.y, destination.y) ? 0 :
        signOf(destination.y - sprite.position.y) * ySpeed;
}

function distanceSquared(a, b) {
    return Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
}

function distance(a, b) {
    return Math.sqrt(distanceSquared(a,b));
}

function signOf(number) {
    return number > 0 ? 1 : number < 0 ? -1 : 0;
}

/*
 function move(sprite) {
 kd.tick();

 kd.UP.down(function () {
 sprite.position.y -= 1;
 });
 kd.DOWN.down(function () {
 sprite.position.y += 1;
 });
 kd.RIGHT.down(function () {
 sprite.position.x += 1;
 });
 kd.LEFT.down(function () {
 sprite.position.x -= 1;
 });
 }*/
