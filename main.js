const Discord = require('discord.js');
let schedule = require('node-schedule');
const request = require('request');

let env = require('./env.json');

const client = new Discord.Client();

var mysql      = require('mysql');
var connection = mysql.createPool({
  host     : env.mysql.host,
  user     : env.mysql.user,
  password : env.mysql.password,
  database : env.mysql.database,
  charset  : "utf8mb4"
});

let roles = new Map(); // Roles will be sorted by role ID
let specialRoles = new Map();
let sticky = new Map();
let defaultChannel;

var uptime = "00h 00m";

// Server status monitor vars
var t = null
var r = null

let oneAM = new Date();
let sevenAM = new Date();
let onePM = new Date();
let sevenPM = new Date();

let nextRestart, lastRestart;

function startStatus(){
    
                    var guild = client.guilds.cache.get("642408796580347927");
                    let channel4 = guild.channels.cache.get("642411949908557826");

                    channel4.messages.fetch({limit:100}).then((ms) => { //Clear channel of unnecessary messages
                        if(ms instanceof Discord.Collection){
                            ms.each((m) => {
                                if(m.author != null && m.author != undefined && m.author.bot == true){
                                    m.delete();
                                }
                            });
                        } else if(m.author != null && m.author != undefined && m.author.bot == true){
                            m.delete();
                        }
                    });

                    var Embed = new Discord.MessageEmbed()
                        .setColor("#ff8c00")
                        .setAuthor('PhoenixRP', "https://cdn.discordapp.com/attachments/653330374071681035/687607176772190250/LOGORED.png")
                        .setDescription("Im booting up! \n Fetching data...")
                        .setTimestamp(new Date())
                        .setFooter('Made by Mr.Traktoorn');
                    var online = true;
                    channel4.send(Embed).then((m) => {
                        setInterval(() => {
                            //Restart times 
                            oneAM.setHours(1, 0, 0, 0); //1AM
                            sevenAM.setHours(7, 0, 0, 0); //7AM
                            onePM.setHours(13, 0, 0, 0); //1PM
                            sevenPM.setHours(19, 0, 0, 0); //7PM
            
                            //Now we have our restart dates for the current date.
                            //Let's check where we are in the day right now, and possibly change the dates accordingly.
                            let rightNow = new Date();
                            if(rightNow > oneAM){
                                if(rightNow > sevenAM){
                                    if(rightNow > onePM){
                                        if(rightNow > sevenPM){
                                            //Next restart at 1am, next day
                                            oneAM.setDate(oneAM.getDate()+1);
                                            r = "GMT+1 : **1am** | 7am | 1pm | 7pm\nEST : 2am | 8am | 2pm | **8pm**";
                                            nextRestart = oneAM;
                                            lastRestart = sevenPM;
            
                                            //Since the next restart is tomorrow, we can add a day to all of the times;
                                            sevenAM.setDate(sevenAM.getDate()+1);
                                            onePM.setDate(onePM.getDate()+1);
                                            sevenPM.setDate(sevenPM.getDate()+1);
                                        } else {
                                            //Next restart at 7pm
                                            r = "GMT+1 :  1am | 7am | 1pm | **7pm**\nEST : 2am | 8am | **2pm** | 8pm";
                                            nextRestart = sevenPM;
                                            lastRestart = onePM;
                                        }
                                    } else {    
                                        //Next restart at 1pm
                                        r = "GMT+1 : 1am | 7am |**1pm** | 7pm\nEST : 2am | **8am** | 2pm | 8pm";
                                        nextRestart = onePM;
                                        lastRestart = sevenAM;
                                    }
                                } else {
                                    //Next restart at 7am
                                    r = "GMT+1 :  1am | **7am** | 1pm | 7pm\n EST : **3am** | 9am | 3pm | 9pm";
                                    nextRestart = sevenAM;
                                    lastRestart = oneAM;
                                }
                            } else {
                                //Next restart 1am this day
                                r = "GMT+1 : **1am** | 7am | 1pm | 7pm\nEST : 2am | 8am | 2pm | **8pm**";
                                nextRestart = oneAM;
                            }
                            client.user.setActivity(`${client.users.cache.size} PhoenixRP members!`, { type: 'WATCHING' });
                            var ja = request('https://servers-live.fivem.net/api/servers/single/kqevrr', { json: true }, async (err, res, body) => {
                                if (body != null && body != undefined && body.Data != null && body.Data != undefined) {
                                    var hostname = body['Data']['hostname'];
                                    var players = body["Data"]["clients"];
                                    var maxp = body["Data"]["sv_maxclients"];
            
                                    if(body['Data']["vars"]['Uptime'] != undefined && body['Data']["vars"]['Uptime'] != null){
                                        uptime = body['Data']['vars']['Uptime'];
                                    }
            
            
                                    t = new Date(nextRestart);
                                    t.setHours(t.getHours() - rightNow.getHours());
                                    t.setMinutes(t.getMinutes() - rightNow.getMinutes());
                                    
                                    t = ("0"+t.getHours()).slice(-2)+"h "+("0"+t.getMinutes()).slice(-2)+"m";
            
                                    if (!online){ 
                                        online = true; 
                                    }
                                    var hasQue = false;
                                    if (hostname[0] == "[") {
                                        hasQue = true;
                                    }
                                    var que = 0;
                                    if (hasQue) {
                                        var regex = /[+-]?\d+(?:\.\d+)?/g;
                                        var match = regex.exec(hostname);
                                        que = match[0];
                                    } else {
                                        que = "0";
                                    }
                                    var Embed = new Discord.MessageEmbed()
                                        .setColor("#ff8c00")
                                        .setAuthor('PhoenixRP', "https://cdn.discordapp.com/attachments/653330374071681035/687607176772190250/LOGORED.png")
                                        .setDescription(`:white_check_mark: **Server IP :** connect phoenix-rp.co.uk\n:white_check_mark: **TeamSpeak IP :** ts.phoenix-rp.co.uk\n\n **Server Restart Times** \n` + r + `\n\n **Next Restart :** ` + t)
                                        .addField('**Players**', players + "/" + maxp, true)
                                        .addField('**Queue**', que, true)
                                        .addField('**Server Uptime**', uptime, true)
                                        .setTimestamp(new Date())
                                        .setFooter('Made by Mr.Traktoorn');
                                    m.edit(Embed);
                                    online = true;
                                }
                                else if (online && res.statusCode == 200) {
                                        var Embed = new Discord.MessageEmbed()
                                            .setColor("#ff8c00")
                                            .setAuthor('PhoenixRP', "https://cdn.discordapp.com/attachments/653330374071681035/687607176772190250/LOGORED.png")
                                            .setDescription(`:x: **Server IP:** connect phoenix-rp.co.uk\n:white_check_mark: **TeamSpeak IP:** ts.phoenix-rp.co.uk\n\n **Server Restart Times** \n` + r + `\n\n **Next Restart :** Server Down`)
                                            .addField('**Players**', "0/64", true)
                                            .addField('**Queue**', "0", true)
                                            .addField('**Server Uptime**', "Server down", true)
                                            .setTimestamp(new Date())
                                            .setFooter('Made by Mr.Traktoorn');
                                        m.edit(Embed)
                                        online = false;
                                    }
                            });
                        }, 30000)
                    }).catch((error) => { console.log("something went wrong\n"+error) });
}
function loadDefaultChannel(){
	connection.query("SELECT rid FROM default_channel LIMIT 1", [], (err, results, fields) => {
		if(err) console.log("Error while getting default channel:\n"+err);

		if(results != null && results != undefined && results.length > 0){
			defaultChannel = client.guilds.cache.first().channels.cache.get(results[0].rid);
		}
	});
}
//To do functions
function awaitResponse(from, channel, matches, data){
}
function findMember(guild, name){
    let promise = new Promise((resolve, reject) => {
        name = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); //Escaping bad characters, just in case
        let members = []; //A new array for our matches
        let id = 1;
        let i = 1;
        guild.members.fetch({query:name, limit:10}).then((response) => {
            response.each((member) => {
                members.push(`[#${id}] - Username: ${member.user.username} ; Nickname: ${member.nickname}`);
                id++;
                if(i == response.size){
                    resolve(members);
                } else i++;

            });
        });
    });

    return promise;
}
//End to do
function mute(message, until, reason, textDuration){
    let untilString;
    if(until == null){
        until = new Date(0);
        untilString = "permanently";
    } else {
        textDuration = textDuration.replace("d", "D ");
        textDuration = textDuration.replace("h", "h ");
        textDuration = textDuration.replace("m", "min ");
        textDuration = textDuration.replace("s", "s ");
        untilString = textDuration;
        }

    connection.query("INSERT INTO mutes VALUES (NULL, ?, DEFAULT, ?, ?, ?, 1)", [message.mentions.members.first().id, until, message.content.split(reason)[1].trim(), message.member.id], (err, results, fields) => {
        if(err) throw err;
        if(results.affectedRows > 0){
            //Successfully muted user, notify user, notify admin/mod, create schedule to remove mute
            sendMessage(message.mentions.members.first(), infoMessage("You've been muted on "+message.guild.name+".").addField("Duration: ", until).addField("Reason: ", message.content.split(reason)[1].trim()), true);
            sendMessage(message, successMessage("User "+message.mentions.members.first().displayName+" successfully muted!\n**Duration:**\n**"+untilString+"**!\n**Reason:**\n"+message.content.split(reason)[1].trim()), false, true, "mute");
            message.mentions.members.first().roles.add(specialRoles.get("mute"));

            scheduleUnmute();

        }
    });
}
function unmute(message){
    connection.query("UPDATE mutes SET active = 0 WHERE uid = ?", [message.mentions.members.first().id], (err, results, fields) => {
        if(err) throw err;
        if(results.affectedRows > 0){
            sendMessage(message, successMessage("Successfully unmuted user "+message.mentions.members.first().displayName),false, true, "mute");
            message.mentions.members.first().roles.remove(specialRoles.get("mute"));
            sendMessage(message.mentions.members.first(), successMessage("You've been unmuted from "+message.guild.name+"."), true);
        }
    });
}
function warn(message, warning){
    if(warning == null || warning == undefined || warning.length == 0){
	warning[0] = null
	warning[1] = "none";
    }
    sendMessage(message.mentions.members.first(), warnMessage(warning[1]).addField("Sent by: ", message.member.displayName), true);
    connection.query("INSERT INTO warns VALUES(NULL, ?, DEFAULT, ?, ?)", [message.mentions.members.first().id, warning[1], message.author.id], (err, results, fields) => {
        if(err) throw err;
        if(results.affectedRows > 0){
            sendMessage(message, successMessage("Successfully warned user **"+message.mentions.members.first().displayName+"**\nReason:\n"+warning[1]), false, true, "warn");
        }
    });
}
function removeWarning(message, id){
    connection.query("DELETE FROM warns WHERE id = ?", [id], (err, results, fields) => {
        if(err) throw err;
        if(results.affectedRows > 0){
            sendMessage(message, successMessage("Successfully removed warning #"+id), false, true, "warn");
        } else sendMessage(message, errorMessage("Could not find warning ID #"+instruction), false);
    });
}
function kick(message, reason){
    connection.query("INSERT INTO kicks VALUES (NULL, ?, DEFAULT, ?, ?)", [message.mentions.members.first().id, reason, message.author.id], (err, results, fields) => {
        if(err) throw err;
        if(results.affectedRows > 0){
            sendMessage(message.mentions.members.first(), infoMessage("You've been kicked from "+message.guild.name+".\nIssued by "+message.author.displayName+"\n**Reason**\n"+reason), true);
            setTimeout(() => {
                message.mentions.members.first().kick(reason).then((response) => {
                    //success kick
                    sendMessage(message, successMessage(`User ${message.mentions.members.first().displayName} successfully kicked!\nReason\n${reason}`), false, true, "kick"); 
                }).catch((e) => console.log(e));
            }, 2000);
        } else sendMessage(message, errorMessage("Something went wrong while trying to kick this member."), false);
    });
}
function ban(message, until, reason, textDuration){
    let untilString;
    if(until == null){
        untilString = "permanently";
        until = new Date(0);
    } else{
        textDuration = textDuration.replace("d", "D ");
        textDuration = textDuration.replace("h", "h ");
        textDuration = textDuration.replace("m", "min ");
        textDuration = textDuration.replace("s", "s ");
        untilString = textDuration;
    }

    connection.query("INSERT INTO bans VALUES (NULL, ?, DEFAULT, ?, ?, ?, 1)", [message.mentions.members.first().id, until, reason, message.author.id], (err, results, fields) => {
        if(err) throw err;
        if(results.affectedRows > 0){
            message.channel.createInvite({maxAge:0, maxUses:1, unique:true, reason:"Unban invite."}).then((invite) => {
                sendMessage(message.mentions.members.first(), infoMessage("You've been banned from "+message.guild.name+". You can use the invite link once/if your ban expires.\n**Duration:**\n"+until+"\n**Banned by:**\n"+message.member.displayName+"\n**Reason:**\n"+reason), true);
                sendMessage(message.mentions.members.first(), invite.url, true);
                
                setTimeout(()=>{
                    message.mentions.members.first().ban({"days":7, "reason":reason}).then((user)=>{
                        sendMessage(message, successMessage("Successfully banned user **"+user.displayName+"**\n**Duration**:\n"+untilString+"\n**Reason:**\n"+reason), false, true, "ban");
                        scheduleUnban();
                    }).catch((e) => {console.error("Something happened while banning user =>\n"+e); sendMessage(message, errorMessage("Error while banning user."), false)})
                }, 2000);
            }).catch((e) => {console.error("Error while creating invite =>\n"+e)});
        } else sendMessage(message, errorMessage("Something went wrong while trying to ban this member."), false);
    });
}
function unban(message, auto){
    let member = null;
    let mid;
    if(auto != null && auto != undefined){
        member = message;
        mid = message;
    } else {
        member = message.content.split(" ")[1].trim();
        mid = member.id; 
        var auto = false;
    }

    connection.query("UPDATE bans SET active = 0 WHERE uid = ?", [mid], (err, results, fields) => {
        if(err) console.error("Error while unbanning =>\n"+err);
            if(auto != null && auto != undefined){
                client.guilds.cache.first().members.unban(member).then((u) => {
                    defaultChannel.send(logMessage(null, `User **${u.username}** successfully unbanned.`, "ban"));
                });
            } else {
                message.guild.members.unban(member).then((u) => {
                    if(!auto)
                        sendMessage(message, successMessage(`User **${u.username}** successfully unbanned.`), false, true, "ban");
                }).catch((e) => {sendMessage(message, errorMessage("User is not banned."), false); console.log(e)})
            }
    });
}
function removeSticky(cid){
    connection.query("DELETE FROM sticky WHERE cid = ?", [cid], (err, results, fields) => {
        if(err) console.error("Something went wrong while removing a sticky message =>\n"+err);

        if(results.affectedRows > 0){

            let m = sticky.get(cid);

            if(m != null && m != undefined){
                m.delete().then(() => {sticky.delete(cid)});
            }


        }
    });
}
function updateSticky(cid, nm){
    connection.query("UPDATE sticky SET mid = ? WHERE cid = ?", [nm.id, cid], (err, results, fields) => {
        if(err) throw err;
    });
}
function addSticky(message, content){
    // Add or update sticky in the database
    connection.query("REPLACE INTO sticky VALUES(NULL, ?, ?, DEFAULT, ?, ?) ", [message.channel.id, message.id, content, message.author.id], (err, results, fields) => {
        if(err) console.error("Error while inserting a new sticky message =>\n"+err);
        // If we changed anything proceed
        if(results.affectedRows > 0){
            // Create a new embed
            let s = new Discord.MessageEmbed()
            .setTimestamp(new Date())
            .setTitle("**__Stickied Message:__**")
            .setDescription(content)
            .setFooter("Sticky message")
            .setColor(0xFFA500);
            // Send it to the correct channel
            message.channel.send(s).then((m) => {
                //If the send is successfull, add it to our local sticky Map.
                sticky.set(m.channel.id, m);
                message.delete();
            }).catch((e) => {console.error("Something happened while sending sticky message =>\n"+e)});
        } else sendMessage(message, errorMessage("Something happened while trying to create a new sticky message. Try again?"), false);
    });
}
function displayInfo(member, type){
    let promise = new Promise((resolve, reject) => {
        var t;
        if(type == "warn"){
            t = "warns";
        } else if(type == "mute"){
            t = "mutes";
        } else if(type == "kick"){
            t = "kicks";
        } else if(type == "ban"){
            t = "bans";
        }
        connection.query("SELECT * FROM "+t+" WHERE uid = ?", [member.id], (err, results, fields) => {
            if(err) reject(err);

            let info = new Discord.MessageEmbed();
            if(results.length > 0){
                for(let i = 0; i < results.length; i++){
                    info.addField("[#"+results[i].id+"], issued by **"+member.guild.members.cache.get(results[i].issued_by).displayName+"**", results[i].reason+"\n*"+results[i].date.toString()+"*");
                    if(i == results.length - 1){
                        resolve(info);
                    }
                }
            } else resolve(null);
        });
    });
    return promise;
}
function checkPermissions(member){
    let i = 0;
    let promise = new Promise((resolve, reject) => {
        roles.forEach((value, key, map) => {
            i++;
            if(member.roles.cache.has(key)){
                resolve(value);
            }
            if(roles.size == i){
                reject(null);
            }
        });
    });
    return promise;
}
function successMessage(content){
    const embed = new Discord.MessageEmbed()
    .setTitle("✅ Success!")
    .setColor(0x28a745)
    .setDescription(content)
    .setTimestamp(new Date());

    return embed;
}
function errorMessage(content){
    const embed = new Discord.MessageEmbed()
    .setTitle("❌ Error!")
    .setColor(0xdc3545)
    .setDescription(content)
    .setTimestamp(new Date());

    return embed;
}
function warnMessage(content){
    const embed = new Discord.MessageEmbed()
    .setTitle("⚠️ Warning!")
    .setColor(0xffc107)
    .setDescription(content)
    .setTimestamp(new Date());

    return embed;
}
function infoMessage(content){
    const embed = new Discord.MessageEmbed()
    .setTitle("ℹ️ Info message!")
    .setColor(0x17a2b8)
    .setDescription(content)
    .setTimestamp(new Date());
    
    return embed;
}
function logMessage(message, content, type){
    let color = 0x007bff;
    if(type != undefined && type != null){
        if(type == "warn")
            color = 0xffc107
        else if(type == "mute")
            color = 0xff8307
        else if(type == "kick")
            color = 0xbd2130
        else if(type == "ban")
            color = 0x117a8b
    }
        let embed = new Discord.MessageEmbed()
        .setTitle(":clipboard: Log")
        .setColor(color)
        .setTimestamp(new Date());
    if(message != null){
        embed.addField("Channel:", message.channel.name, true)
        .addField("By:", message.member.displayName, true)
        .setDescription(content.description);
        if(message.mentions != null && message.mentions != undefined && message.mentions.members.first() != undefined && message.mentions.members.first() != null){
            embed.addField("Member involved: ", "**Display name:** "+message.mentions.members.first().displayName+"\n**ID:** "+message.mentions.members.first().id, true);
        }
    } else {
        embed.setDescription(content).addField("By: ", "*Automatic action by PhoenixRP bot.*");
    }

	return embed;
}
function memberListMessage(list){
    const embed = new Discord.MessageEmbed()
    .setTitle("Found members:")
    .setTimestamp(new Date());

    let newList = "";
    for(let i = 0; i < list.length; i++){
        newList += list[i]+"\n";

        if(i == list.length - 1){
            embed.setDescription(newList);
        }
    }

    return embed;
}
function sendMessage(to, content, private, log, type){ //If we want to send a private message, we pass user, otherwise pass message
    if(private){
        to.send(content).catch((e) => {console.error("Error while sending private message =>\n"+e)});
    } else {
        to.channel.send(content).catch((e) => {console.error("Error while sending public message =>\n"+e)});;
    }
    if(log != null && log != undefined && log == true){
        if(defaultChannel != null){
	    defaultChannel.send(logMessage(to, content, type));
	}
    }
}
function stringToDateTime(string){
    //day, hour, minute, second
    let d = string.match(/[0-9]*d/g);
    let h = string.match(/[0-9]*h/g);
    let m = string.match(/[0-9]*m/g);
    let s = string.match(/[0-9]*s/g);

    let date = new Date();

    if(d != undefined && d != null && d.length > 0){
        d = d[0];
        d = d.split("d")[0];
        d = parseInt(d);
        date.setHours(date.getHours() + d*24);
    }

    if(h != undefined && h != null && h.length > 0){
        h = h[0];
        h = h.split("h")[0];
        h = parseInt(h);
        date.setHours(date.getHours() + h);
    }

    if(m != undefined && m != null && m.length > 0){
        m = m[0];
        m = m.split("m")[0];
        m = parseInt(m);
        date.setMinutes(date.getMinutes() + m);
    }
        
    if(s != undefined && s != null && s.length > 0){
        s = s[0];
        s = s.split("s")[0];
        s = parseInt(s);
        date.setSeconds(date.getSeconds() + s);
    }
    return date;

}

// Scheduling
    // Select the nearest date from the database.
    // Create schedule for that date
    // Once that schedule process is complete - repeat
    // 
    // Possibly the most conservative way of doing this, however effectiveness should stay the same.
        // Less resource usage

function scheduleUnmute(){
    connection.query("SELECT * FROM mutes WHERE duration > NOW() AND active = 1 ORDER BY duration LIMIT 1", [], (err, results, fields) => {
        if(err) console.error("Something went wrong while scheduling unmute =>\n"+err);

        if(results.length > 0){
            let when = new Date(results[0].duration);

            let uid = results[0].uid;

            member = client.guilds.cache.first().members.cache.get(uid);

            let unmute = schedule.scheduleJob(when, () => {
                connection.query("UPDATE mutes SET active = 0 WHERE uid = ?", [member.id], (err, results, fields) => {
                    if(err) throw err;
                    if(results.affectedRows > 0){
                        member.roles.remove(specialRoles.get("mute"));
                        sendMessage(member, successMessage("You've been unmuted from "+client.guilds.cache.first().name+"."), true);
                        scheduleUnmute();
                        unmute.cancel();
                    } //Else it does not exist, maybe previously deleted.
                });
            });
        }
    });
    
}
function scheduleUnban(){
    connection.query("SELECT * FROM bans WHERE duration > NOW() AND active = 1 ORDER BY duration LIMIT 1", [], (err, results, fields) => {
        if(err) console.error("Something went wrong while scheduling unban =>\n"+err);

        if(results != null && results != undefined && results.length > 0){
            let when = new Date(results[0].duration);
            let uid = results[0].uid;

            let u = schedule.scheduleJob(when, () => {
                    unban(uid, true);
                });
        }
    });
}
function checkMissed(){
    // In case a bot crashes when it was supposed to unmute/unban it will miss it's cycle. Therefore we need some way of dealing with these cases.
    connection.query("SELECT * FROM mutes WHERE active = 1 AND duration != ?", [new Date(0)], (err, results, fields) => {
        if(err) console.error("Error while checking missed unmutes.=>\n"+err);

        for(let i = 0; i < results.length; i++){
            if(results[i].duration < new Date()){
                connection.query("UPDATE mutes SET active = 0 WHERE uid = ?", [results[i].uid], (err, results, fields) => {
                    if(err) console.error(`Error while unmuting uid ${results[i].uid} =>\n`+err);
                });
            }
        }
    });
    connection.query("SELECT * FROM bans WHERE active = 1 AND duration != ?", [new Date(0)], (err, results, fields) => {
        if(err) console.error(`Error while checking missed unbans.=>\n`+err);

        for(let i = 0; i < results.length; i++){
            if(results[i].duration < new Date()){
                mid = results[i].uid
                connection.query("UPDATE bans SET active = 0 WHERE uid = ?", [results[i].uid], (err, results, fields) => {
                    if(err) console.error(`Error while unbanning uid ${mid} =>\n`+err);
                    unban(mid, true);
                });
            }
        }
    });
}
function loadSticky(){
    sticky.clear();
    connection.query("SELECT cid, mid FROM sticky", [], (err, results, fields) => {
        if(err) console.error("Error while loading sticky data =>\n"+e);
        if(results.length > 0){
            for(let i = 0; i < results.length; i++){
                client.channels.fetch(results[i].cid).then((c) => {
                    if(c != null && c != undefined){
                        c.messages.fetch(results[i].mid).then((m) => {
                            if(m != null && m != undefined){
                                c.send(m.embeds[0]).then((nm) => {
                                    m.delete();
                                    sticky.set(c.id, nm);
                                    updateSticky(c.id, nm);
                                })
                            }
                        }).catch(() => {
                            //Message id got lost, so we need to search for the message
                            //Unfortunately the limit is 100 messages
                            c.messages.fetch({limit:100}).then((m) => {
                                if(m != null && m != undefined){
                                    if(m instanceof Discord.Collection){ //multiple messages
                                        m.some((sm) => {
                                            if(sm.embeds != null && sm.embeds != undefined){
                                                if(sm.embeds.length > 0 && sm.embeds[0] != null && sm.embeds[0] != undefined){
                                                    if(sm.embeds[0].footer != null && sm.embeds[0].footer != undefined){
                                                        if(sm.embeds[0].footer.text == "Sticky message"){                                                                                                                   
                                                            c.send(sm.embeds[0]).then((nm) => {
                                                                sm.delete();
                                                                updateSticky(c.id, nm);
                                                                sticky.set(c.id, nm);
                                                                return true;  
                                                            });
                                                        }
                                                    }
                                                }
                                            }
                                        });
                                    } else { //single message
                                        if(m.embeds != null && m.embeds != undefined){
                                            if(m.embeds.length > 0 && m.embeds[0] != null && m.embeds[0] != undefined){
                                                if(m.embeds[0].footer != null && m.embeds[0].footer != undefined){
                                                    if(m.embeds[0].footer.text == "Sticky message"){
                                                        c.send(m.embeds[0]).then((nm) => {
                                                            sm.delete();
                                                            updateSticky(c.id, nm);
                                                            sticky.set(c.id, nm);  
                                                        });
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    
                                }
                            });
                        });
                    }
                });
            }
        }
    });
}
function loadRoles(){
    roles.clear();
    connection.query("SELECT rid, kick, ban, warn, mute, sticky, admin FROM permissions", [], (err, results, fields) => {
      if(err) throw err; //If there is an error for some reason throw it ( to console usually ) 

      if(results != null && results != undefined){ //If we get any results. Probably will once everything is setup
        for(let i = 0; i < results.length; i++){ //Let's loop through our results, format them and place them in our variable
            roles.set(results[i].rid, {"kick":results[i].kick, "ban":results[i].ban, "mute":results[i].mute, "warn":results[i].warn, "sticky":results[i].sticky, "admin":results[i].admin});
        }
      }
  });
}
function loadSpecialRoles(){
    specialRoles.clear();
    connection.query("SELECT type, rid FROM roles", [], (err, results, fields) => {
        if(err) throw err;

        if(results != null && results != undefined){
            for(let i = 0; i < results.length; i++){
                specialRoles.set(results[i].type, results[i].rid);
            }
        }
    });
}
client.on('ready', () => {
  console.log('I am ready!');

  //Let's load our roles and premissions just to save unecessary database checks.

  loadRoles();
  loadSpecialRoles();
  loadSticky();
  loadDefaultChannel();
  
  scheduleUnban();
  scheduleUnmute();

  checkMissed();

  startStatus();

});
// Create an event listener for messages
client.on('message', message => {
    if(sticky.size > 0){ //If there are sticky messages.
     //We need to check if the message is actually a sticky message sent from the bot, if it is not we proceed
     let m = sticky.get(message.channel.id);
        if(m != null && m != undefined){
            if(message.content.toLowerCase() != env.prefix+"remove sticky"){
                if(message.embeds == null || message.embeds == undefined || message.embeds.length == 0 || message.embeds[0].footer == undefined||message.embeds[0].footer.text != "Sticky message"){
                        m.channel.send(m.embeds[0]).then((nm) => {
                            sticky.set(message.channel.id, nm);
                            updateSticky(message.channel.id, nm);
                        }).catch((e) => {console.error("Error while replacing sticky message =>\n"+e)});
                        m.delete();
                }
            }
        }
    }

    // Status channel
    if(message.channel.id == "642411949908557826"){
        if(message.embeds.length == 1){
            if(message.embeds[0].description != null && message.embeds[0].description != undefined){
                if(message.embeds[0].description == "Server restarted successfully. You are now able to reconnect."){
                    setTimeout(()=>{ //We've detected that there is a restart completed, wait 15 minutes and then remove the messages.
                    client.channels.fetch("642411949908557826").then((c) => {
                        c.messages.fetch({limit:100}).then((ms) => {
                            if(ms instanceof Discord.Collection){
                                ms.each((m) => {
                                    if(m.author != null && m.author != undefined && m.author.bot == true && m.author.id != "695719904095240203"){
                                        m.delete();
                                    }
                                });
                            } else if(m.author != null && m.author != undefined && m.author.bot == true && m.author.id != "695719904095240203"){
                                m.delete();
                            }
                        });
                    })
                    }, 900000);
                }
            }
        }
    }
    
    if(message.content[0] == env.prefix){ //If our message starts with a prefix
        let instruction = message.content.substr(1); //Then let's remove the prefix and store it in instruction variable
        instruction = instruction.trim().toLowerCase().split(" "); //Let's just trim excess whitespaces, move everything to lowercase and split the instruction by whitespaces
        //Now we can do our regular checks.

        //Add and remove roles that can be administrators/moderators
            //Set permissions for roles such as kick, ban, warn, mute
        //Kick, ban, warn, mute commands
        if(instruction[0] == "add"){ //Only owner can issue this command
            checkPermissions(message.member).then((value) => {
                if((value != null && value.admin == 1) || message.author.id == message.guild.ownerID){
                    if(instruction[1][0] == "-"){
                        let kick = 0, ban = 0, warn = 0, mute = 0, sticky = 0, admin = 0;
        
                        if(instruction[1].includes("k"))
                            kick = 1;
                        if(instruction[1].includes("b"))
                            ban = 1;
                        if(instruction[1].includes("w"))
                            warn = 1;
                        if(instruction[1].includes("m"))
                            mute = 1;
                        if(instruction[1].includes("a"))
                            admin = 1;
                        if(instruction[1].includes("s"))
                            sticky = 1;
                        
                        if(kick == 0 && ban == 0 && warn == 0 && mute == 0 & sticky == 0 && admin == 0){
                            sendMessage(message, errorMessage("Cannot add roles without permissions."), false);
                        } else {
                            if(message.mentions != null && message.mentions != undefined && message.mentions.roles != null && message.mentions.roles != undefined){ // If there are roles mentioned
                                message.mentions.roles.each((role) => {
                                    if(!roles.has(role.id)){
                                        connection.query("INSERT INTO permissions VALUES (NULL, ?, DEFAULT, ?, ?, ?, ?, ?, ?)", [role.id, mute, kick, warn, ban, sticky, admin], (err, results, fields) => {
                                            if(err) throw err;
        
                                            if(results.affectedRows > 0){
                                                //Success
                                                sendMessage(message, successMessage("Successfully added role "+role.name), false);
                                                loadRoles();
                                            }
                                        });
                                    } else sendMessage(message, errorMessage("Could not add role "+role.name+". It already exists."), false);
                                });
                            } else sendMessage(message, errorMessage("You need to mention a role in order to add it."), false);
                        }
                    } else sendMessage(message, errorMessage("You cannot add roles without permisions. use `"+env.prefix+"add -<k b w m> role`"), false);
                }
            }).catch(() => {})
        } else if(instruction[0] == "remove"){
            if(instruction[1] == "sticky"){
                checkPermissions(message.member).then((value) => {
                    if(value != null && value.sticky == 1){
                        removeSticky(message.channel.id);
                        message.delete();
                    } else sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"remove sticky`"), false);
                }).catch(() => {})
            } else 
            if(message.mentions != null && message.mentions != undefined && message.mentions.roles != null && message.mentions.roles != undefined){ // If there are roles mentioned
                message.mentions.roles.each((role) => {
                    if(roles.has(role.id)){
                        connection.query("DELETE FROM permissions WHERE rid = ?", [role.id], (err, results, fields) => {
                            if(err) throw err;

                            if(results.affectedRows > 0){
                                //Success
                                sendMessage(message, successMessage("Successfully removed role "+role.name), false);
                                loadRoles();
                            }
                        });
                    } else sendMessage(message, errorMessage("Could not remove role "+role.name+". It does not exists in our records."), false);
                });
            }
        } else if(instruction[0] == "warn"){
            //warn @user reason
            checkPermissions(message.member).then((value) => {
                if(value != null && value.warn == 1){
                        //They have permissions.
                        //Now we can check if they composed the message properly
                        if(instruction [1] == "remove" || instruction[1] == "r" || instruction[1] == "rm"){
                            if(instruction[2] != undefined && instruction[2] != null && !isNaN(instruction[2])){ //If they inserted the warn id and if it is a number
                                removeWarning(message, instruction[2]);
                            } else { //They did not enter a valid value as the warn id
                                //Display warn data for user
                                //Let them know to enter the command again.
                                sendMessage(message, errorMessage("You didn't enter a valid value as the warn ID."), false);
                            }
                        } else if(message.mentions != null && message.mentions != undefined && message.mentions.members != null && message.mentions.members != undefined){
                            let warning = message.content.split(instruction[1]);
                            if(warning != null && warning != undefined && warning.length > 0 && warning[1] != null && warning[1] != undefined && warning[1].length > 0){
                                //Let's just send them a message first, just in case something goes wrong with inserting into db. They don't need to know we have db problems :D
                                warn(message, warning);
                            } else sendMessage(message, errorMessage("You need to have a reason to warn this member. Please try again."));
                        } else sendMessage(message, errorMessage("You need to mention a member in order to warn them!"), false);
                    } else sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"warn`"), false);
            }).catch(() => {});
        } else if(instruction[0] == "mute"){
            //mute @user -time reason
            if(specialRoles.has("mute")){
                checkPermissions(message.member).then((value) => {
                    if(value != null && value.mute == 1){
                            //They have permissions.
                            //Now we can check if they composed the message properly
                            if(message.mentions != null && message.mentions != undefined && message.mentions.members != null && message.mentions.members != undefined){
                                connection.query("SELECT * FROM mutes WHERE uid = ? AND active = 1", [message.mentions.members.first().id], (err, results, fields) => {
                                    if(err) throw err;

                                    if(results.length > 0){
                                        sendMessage(message, errorMessage("This user is already muted!"), false);
                                    } else {
                                        if(instruction[2] != undefined && instruction[2] != undefined && instruction[2][0] == "-"){
                                            let string = instruction[2].split("-");
                                            let until = stringToDateTime(string[1]);

                                            if(string[1] != null && string[1] != undefined && string[1].length > 0 && string[1] != " "){
                                                mute(message, until, string[1], string[1]);
                                            } else sendMessage(message, errorMessage("You need to have a reason to mute this member. Please try again."), false);
                                            
                                        } else {
                                            if(instruction[2] != null && instruction[2] != undefined && instruction[2].length > 0){
                                                mute(message, null, instruction[1]);
                                            } else sendMessage(message, errorMessage("You need to have a reason to mute this member. Please try again."), false);
                                        }
                                    }
                                });
                            } else sendMessage(message, errorMessage("You need to mention a member in order to mute them!"), false);
                        } else sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"mute`"), false);
                }).catch(() => {});
            } else sendMessage(message, errorMessage("The bot isn't properly configured. You need to add a mute role first!"), false);
        } else if(instruction[0] == "unmute"){
            checkPermissions(message.member).then((value) => {
                if(value != null && value.mute == 1){ //If they have the role, and permissions to mute
                    if(message.mentions != null && message.mentions != undefined && message.mentions.members != null && message.mentions.members != undefined){
                        unmute(message);
                    } else sendMessage(message, errorMessage("You need to mention a member in order to mute them!"), false);
                } else sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"mute`"), false);
            }).catch(()=>{});
        } else if(instruction[0] == "kick" || instruction[0] == "k"){
            checkPermissions(message.member).then((value) => {
                if(value != null && value.kick == 1){ //If they have the role, and permissions to mute
                    if(message.mentions != null && message.mentions != undefined && message.mentions.members != null && message.mentions.members != undefined){
                        if(message.member.roles.highest.comparePositionTo(message.mentions.members.first().roles.highest) > 0){
                            let reason = message.content.split(instruction[1])[1];
                            if(reason != null && reason != undefined && reason.length > 0){
                                reason = reason.trim();
                                kick(message, reason);
                            } else sendMessage(message, errorMessage("You cannot kick a member without stating a reason. Please try again."), false);
                        } else sendMessage(message, errorMessage("Cannot kick. This member has higher priviledges than you."), false);
                    } else sendMessage(message, errorMessage("You need to mention a member you want to kick first!"), false)
                } else sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"kick`"), false);
            }).catch(() => {});
        } else if(instruction[0] == "ban" || instruction[0] == "b"){
            checkPermissions(message.member).then((value) => {
                if(value != null && value.ban == 1){ //If they have the role, and permissions to mute
                    if(message.mentions != null && message.mentions != undefined && message.mentions.members != null && message.mentions.members != undefined){
                        if(instruction.length > 2){
                            if(message.member.roles.highest.comparePositionTo(message.mentions.members.first().roles.highest) > 0){
                                let until = null;
                                let reason = null;
                                let string = null;
                                if(instruction[2][0] == "-"){
                                    string = instruction[2].split("-")[1];
                                    reason = message.content.split(instruction[2])[1];
                                    until = stringToDateTime(string);
                                } else {
                                    reason = message.content.split(instruction[1])[1];
                                }
                                if(reason != null && reason != undefined && reason.length > 0){
                                    reason = reason.trim();
                                    if(message.mentions.members.first().bannable){
                                        ban(message, until, reason, string);
                                    } else sendMessage(message, errorMessage("This member is not bannable."), false);
                                } else sendMessage(message, errorMessage("You cannot ban a member without stating a reason. Please try again."), false);
                            } else sendMessage(message, errorMessage("Cannot ban. You need more priviledges to ban this user."), false);
                        } else sendMessage(message, errorMessage("You cannot ban a member without stating a reason. Please try again."), false);
                    } else sendMessage(message, errorMessage("You need to mention a member you want to ban first!"), false)
                } else sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"ban`"), false);
            }).catch(() => {});
        } else if(instruction[0] == "unban"){
            checkPermissions(message.member).then((value) => {
                console.log("perms");
                if(value != null && value.ban == 1){
                    console.log("perms checked");
                    if(instruction[1] != null && instruction[1] != undefined && instruction[1].length > 0){
                        console.log("id sent");
                        unban(message);
                    } else console.log("asd");
                } else sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"unban`"), false)
            }).catch(() => {});
        } else if(instruction[0] == "role" && message.guild.ownerID == message.member.id){
            if(instruction[1] == "add"){
                if(instruction[2] == "muted"){
                    if(message.mentions != null && message.mentions != undefined && message.mentions.roles != null && message.mentions.roles != undefined){
                        connection.query("INSERT INTO roles VALUES(NULL, ?, 'mute', DEFAULT) ON DUPLICATE KEY UPDATE rid = ?", [message.mentions.roles.first().id, message.mentions.roles.first().id], (err, results, fields) => {
                            if(err) throw err;
                            if(results.affectedRows > 0){
                                sendMessage(message, successMessage("Successfully set muted role to "+message.mentions.roles.first().name), false);
                                loadSpecialRoles();
                            }
                        });
                    } else sendMessage(message, errorMessage("You need to mention a role in order to add it."), false);
                }
            }
        } else if(instruction[0] == "unicorn"){
            message.reply("🦄");
        } else if(instruction[0] == "info"){
            if(message.mentions != null && message.mentions != undefined && message.mentions.roles != null && message.mentions.roles != undefined){
                checkPermissions(message.member).then((value) => {
                    if(value != null){
                        displayInfo(message.mentions.members.first(), "warn").then((response) => {
                            if(response != null){
                                sendMessage(message.author, response.setTitle("Warnings: "), true);
                            } else sendMessage(message.author, infoMessage("This user has no items on their warn record."), true);
                        }).catch((e) => {console.error("Error while trying to display info =>\n"+e)});
                        displayInfo(message.mentions.members.first(), "mute").then((response) => {
                            if(response != null){
                                sendMessage(message.author, response.setTitle("Mutes: "), true);
                            } else sendMessage(message.author, infoMessage("This user has no items on their mute record."), true);
                        }).catch((e) => {console.error("Error while trying to display info =>\n"+e)})
                        displayInfo(message.mentions.members.first(), "kick").then((response) => {
                            if(response != null){
                                sendMessage(message.author, response.setTitle("Kicks: "), true);
                            } else sendMessage(message.author, infoMessage("This user has no items on their kick record."), true);
                        }).catch((e) => {console.error("Error while trying to display info =>\n"+e)})
                        displayInfo(message.mentions.members.first(), "ban").then((response) => {
                            if(response != null){
                                sendMessage(message.author, response.setTitle("Bans: "), true);
                            } else sendMessage(message.author, infoMessage("This user has no items on their ban record."), true);
                        }).catch((e) => {console.error("Error while trying to display info =>\n"+e)})
                    } else sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"info`"), false);
                }).catch(() => {});
            } else sendMessage(message, errorMessage("You need to mention a user to check their info first."), false);
        } else if(instruction[0] == "sticky"){
                let content = message.content.split(env.prefix+""+instruction[0])[1];
                if(content != null && content != undefined && content.length > 0){
                    checkPermissions(message.member).then((value) => {
                        if(value != null && value.sticky == 1){
                            addSticky(message, content);
                        } else sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"sticky`"), false);
                    }).catch(() => {})
                } else sendMessage(message, errorMessage("You cannot set an empty sticky message!"),false);
        } else if(instruction[0] == "set" && instruction[1] == "default" && instruction[2] == "channel"){
            checkPermissions(message.member).then((value) => {
                if((value != null && value.admin == 1) || message.author.id == message.guild.ownerID){
                    connection.query("INSERT INTO default_channel VALUES(1, ?, default, ?) ON DUPLICATE KEY UPDATE rid = ?", [message.channel.id, message.author.id, message.channel.id], (err, results, fields) => {
                        if(err) console.err("Error while inserting default channel\n"+err)
                        if(results.affectedRows > 0){
                            sendMessage(message, successMessage("Successfully added a default channel."), false);
                            defaultChannel = message.channel;
                        } else sendMessage(message, errorMessage("Unable to add a default channel."), false);
                    });
                } else sendMessage(message, errorMessage("You do not have enough permissions to do this."), false);
            })
	    } else if(instruction[0] == "start"){
            checkPermissions(message.member).then((value) => {
                if(value != null && value.admin == 1){
                    startStatus();
                }
            })
        }
    }

});
client.on("guildBanRemove", (guild, user) => {
    //Someone manually unbanned a user, we still want to log this
    connection.query("UPDATE bans SET active = 0 WHERE active = 1 AND uid = ?", [user.id], (err, results, fields) => {
        if (err) console.log("Error while logging manual unbans. =>\n"+err);
    })
});

client.login(env.token);

