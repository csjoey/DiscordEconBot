// Setup Imports
const fs = require('fs');
const Discord = require("discord.js");
const config = require("./config.json");
const client = new Discord.Client();

// Setup runtime constants
const botPrefix = "!"
const respondBots = false;
const requirePrefix = true;
const typeInChannels = ["bot_commands","gambling"];

const adminPerms = new Discord.Permissions(['MANAGE_GUILD']);
const devID = "155528823100669952";
// Setup runtime globals
var guildLiveData = {};
var random;

// On bot ready run preparations
client.on("ready",readyHandle);

function readyHandle(){
    // Startup
    getGuildDatabases();
    eventLoop();
    // Timers 
    client.setInterval(refreshGuilds,11000);
    client.setInterval(saveDatabases,7000);
    client.setInterval(eventLoop,10000);
    client.setInterval(quickEventLoop,5000);
    client.setInterval(shutdownBotSafe,3600000);
    // Event Handlers
	client.on("message", messageHandle);
}

function quickEventLoop(){
    client.guilds.cache.forEach(function(value,key,map){
        updateCurrencyMetadata(value);
    });
}

async function eventLoop(){
    forEachGuild();

}

function forEachInVoice(guild){
    guild.voiceStates.cache.forEach(function(voiceS,voiceK,voiceM){
        if(voiceS.sessionID != null && !voiceS.deaf){
            dropCurrency(voiceS.member,voiceK);
        }
    });
}

function forEachGuild(){
    client.guilds.cache.forEach(function(value,key,map){
        forEachInVoice(value);
        forEachMember(value.members.cache);
    });
}

function forEachMember(members){
    members.forEach(function(value,key,map){
        updateTagCorrelation(value,key);
    });
}

function updateCurrencyMetadata(guild){
    if(!(guildLiveData[guild.id]["currency"]["~metadata"])){
        guildLiveData[guild.id]["currency"]["~metadata"] = {};
    }
    if(!(guildLiveData[guild.id]["currency"]["~metadata"]["allTimeRichest"])){
        guildLiveData[guild.id]["currency"]["~metadata"]["allTimeRichest"] = {};
    }
    var cur_rich = getRichestSnowflake(guild.id);
    if(guildLiveData[guild.id]["currency"][cur_rich] > guildLiveData[guild.id]["currency"]["~metadata"]["allTimeRichest"]["amt"]){
        guildLiveData[guild.id]["currency"]["~metadata"]["allTimeRichest"]["id"] = cur_rich;
        guildLiveData[guild.id]["currency"]["~metadata"]["allTimeRichest"]["amt"] = guildLiveData[guild.id]["currency"][cur_rich];
        }
    }

function getRichestSnowflake(guildSnowflake){
    var balmap = Object.entries(guildLiveData[guildSnowflake]["currency"]).sort(([,a],[,b]) => b-a);
    return balmap[0][0];
}


function updateTagCorrelation(member,snowflake){
    if(!("SnowToTag" in guildLiveData[member.guild.id])){
        guildLiveData[member.guild.id]["SnowToTag"] = {};
    }

    if(!("TagToSnow" in guildLiveData[member.guild.id])){
        guildLiveData[member.guild.id]["TagToSnow"] = {};
    }

    guildLiveData[member.guild.id]["TagToSnow"][member.user.tag] = snowflake;
    guildLiveData[member.guild.id]["SnowToTag"][snowflake] = member.user.tag;
}

function dropCurrency(member,snowflake){
    random = Math.random();
    if(!("currency" in guildLiveData[member.guild.id])){
        guildLiveData[member.guild.id]["currency"] = {};
    }
    if(!(snowflake in guildLiveData[member.guild.id]["currency"])){
        guildLiveData[member.guild.id]["currency"][snowflake] = 0;
    }else{

        var curbal = guildLiveData[member.guild.id]["currency"][snowflake] + 1;
        var curchance = 1000/curbal;
        if((random < curchance) || (random < .10)){
            guildLiveData[member.guild.id]["currency"][snowflake] += 1;
        }
    }
}

function getGuildDatabases(){
    var path;
    var rawdata;
    client.guilds.cache.forEach(function(value,key,map){
        path = './db/' + key + '.json';
        if (fs.existsSync('./db/' + key + '.json')) {
            rawdata = fs.readFileSync(path);
            guildLiveData[key] = JSON.parse(rawdata);
        }else{
            fs.writeFileSync(path,"{}");
            guildLiveData[key] = {};
        }
    });

}

function refreshGuilds(){
    client.guilds.cache.forEach(function(value,key,map){
        value.fetch().then(function(guild){
            refreshMembers(guild);
            client.guilds.cache[key] = guild;
        });
    });
}

function refreshMembers(guild){
    guild.members.fetch().then(function(members){
        guild.members.cache = members;
    });
    return guild;
}

function saveDatabases(){
    var path;
    var data;
    for (const [key, value] of Object.entries(guildLiveData)){
        path = './db/' + key + '.json';
        data = JSON.stringify(value);
        data.replace("null","0");
        fs.writeFileSync(path,data);
    }
}

function shutdownBotSafe(){
    saveDatabases();
    process.kill(process.pid, 'SIGTERM');
}

function checkNull(message){
    if(guildLiveData[message.member.guild.id]["currency"][message.member.id] == null){
        guildLiveData[message.member.guild.id]["currency"][message.member.id] = 0;
    }
}

function messageHandle(message){
	// Error Checking
	if(message == null){
		return;
	} 
	if (message.author.bot && !respondBots){
		return;
	}
	if (!message.content.startsWith(botPrefix) && requirePrefix){
		return;
	}

    // Command sanitizing
	const commandBody = message.content.slice(botPrefix.length);
    const args = commandBody.split(' ');
    const command = args.shift().toLowerCase();

    const messGuild = message.guild.id;
    const messChannel = message.channel.id;


    // Admin Commands
    if (command == 'admin'){
        if(message.member.hasPermission(adminPerms) || message.member.id == devID){
            var guildID = message.member.guild.id;
            var channelID = message.channel.id;

            if(!guildLiveData[guildID]["~metadata"]){
                guildLiveData[guildID]["~metadata"] = {};
            }
            if(!guildLiveData[guildID]["~metadata"]["channels"]){
                guildLiveData[guildID]["~metadata"]["channels"] = {};
            }
        }else{
            return;
        }
        if(args[0] == 'set_channel'){
            if(typeInChannels.includes(args[1])){
                guildLiveData[guildID]["~metadata"]["channels"][args[1]] = channelID;
                message.reply(`Set this channel to ${args[1]}`);
            }else{
                message.reply("Invalid Channel");
            }
        }
    }
    const bot_commands = guildLiveData[messGuild]["~metadata"]["channels"]["bot_commands"];
    const gambling = guildLiveData[messGuild]["~metadata"]["channels"]["gambling"]

    
    if (messChannel != bot_commands && messChannel != gambling){
        message.reply("Not a bot command channel.");
        return;
    }

  	// Command programming

  	if (command == "ping") {
    	const timeTaken = Date.now() - message.createdTimestamp;
    	message.reply(`Pong! This message had a latency of ${timeTaken}ms.`);
  	}

    if (command == 'baltop'){
        var balmap = Object.entries(guildLiveData[message.member.guild.id]["currency"]).sort(([,a],[,b]) => b-a);
        var richestID = guildLiveData[message.guild.id]["currency"]["~metadata"]["allTimeRichest"]["id"];
        var richestTag = guildLiveData[message.member.guild.id]["SnowToTag"][richestID];
        var richestAmt = guildLiveData[message.guild.id]["currency"]["~metadata"]["allTimeRichest"]["amt"];
        message.reply(`
        1. ${guildLiveData[message.member.guild.id]["SnowToTag"][balmap[0][0]]} - ${guildLiveData[message.member.guild.id]["currency"][balmap[0][0]]}
        2. ${guildLiveData[message.member.guild.id]["SnowToTag"][balmap[1][0]]} - ${guildLiveData[message.member.guild.id]["currency"][balmap[1][0]]}
        3. ${guildLiveData[message.member.guild.id]["SnowToTag"][balmap[2][0]]} - ${guildLiveData[message.member.guild.id]["currency"][balmap[2][0]]}
        4. ${guildLiveData[message.member.guild.id]["SnowToTag"][balmap[3][0]]} - ${guildLiveData[message.member.guild.id]["currency"][balmap[3][0]]}
        5. ${guildLiveData[message.member.guild.id]["SnowToTag"][balmap[4][0]]} - ${guildLiveData[message.member.guild.id]["currency"][balmap[4][0]]}

        All time Richest: ${richestTag} - ${richestAmt} 
        `
        );
    }

    if (command == 'dev' && (message.author.id == "155528823100669952" && args[0])){
        if(args[0] == 'shutdown'){
            shutdownBotSafe();
        }

        if(args[0] == 'vc'){
            var msg = "\n";
            client.guilds.cache.forEach(function(value,key,map){
                value.voiceStates.cache.forEach(function(voiceS,voiceK,voiceM){
                    msg += "ID: " + voiceS.id + " Session: " + voiceS.channel + "\n";
                });
        });
            message.reply(msg);
        }


    }

    if (command == 'balance' || command == "bal"){
        checkNull(message);
        message.reply("Balance: " + guildLiveData[message.member.guild.id]["currency"][message.member.id]);
    }

    if ((command == 'send' || command == 'balsend') && args[1]){
        checkNull(message);
        var amt = Number(args.shift());
        var tag = "";
        args.forEach(elem => tag += elem + " ");
        tag = tag.replace("@","").trim();
        var guildID = message.guild.id;
        var senderID = message.member.id;
        var currentBal = guildLiveData[guildID]["currency"][senderID];
        if(amt > 0 && Number.isSafeInteger(amt) && currentBal >= amt){
            if(tag in guildLiveData[guildID]["TagToSnow"]){
                var recipSnow = guildLiveData[guildID]["TagToSnow"][tag];
                if(guildLiveData[guildID]["currency"][recipSnow] == null){
                    message.reply("User has not interacted with their balance, and cannot receive coins.");
                    return;
                }
                guildLiveData[message.member.guild.id]["currency"][senderID] -= amt;
                guildLiveData[message.member.guild.id]["currency"][recipSnow] += amt;
                message.reply(`Sent ${amt} to ${tag}, new balance: ${currentBal-amt}`);
            }else{
                message.reply("Tag not found");
            }
        }else{
            message.reply("Amount invalid");
        }


        
    }

    if (command == 'help'){
        if(!args[0]){
            message.reply(`
            Commands:
            !ping
            !bal | !balance
            !g | !gamble <amount>
            !send | !balsend <amount> <tag>
            `);
        }
    }

    if (command == "gamble" || command == "g"){
        checkNull(message);
        if(Date.now() - message.createdTimestamp > 5000) return;
        if(!args[0]) return;
        if(messChannel != gambling){
            message.reply("Not a gambling channel");
            return;
        }
        var gambleAmt = Number(args[0]);
        if(!Number.isSafeInteger(gambleAmt) || !Number.isInteger(gambleAmt) || gambleAmt <= 0) return;
        gambleAmt = Math.floor(gambleAmt);

        if(guildLiveData[message.member.guild.id]["currency"][message.member.id] < gambleAmt){
            message.reply("Insufficient funds.");
            return;
        }else{
            random = Math.random()
            if(random > .5 || (message.author.id == "155528823100669952" && args[1])){
                guildLiveData[message.member.guild.id]["currency"][message.member.id] += gambleAmt;
                message.reply("Winner Winner, Balance: " + guildLiveData[message.member.guild.id]["currency"][message.member.id])
            }else{
                guildLiveData[message.member.guild.id]["currency"][message.member.id] -= gambleAmt;
                message.reply("You lost :< try again, Balance: " + guildLiveData[message.member.guild.id]["currency"][message.member.id]);
            }
        }
    }
    
}

//Login using secret 
client.login(config.BOT_TOKEN);