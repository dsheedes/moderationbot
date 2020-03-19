const Discord = require('discord.js');
let schedule = require('node-schedule');

let env = require('./env.json');

const client = new Discord.Client();

var mysql      = require('mysql');
var connection = mysql.createPool({
  host     : env.mysql.host,
  user     : env.mysql.user,
  password : env.mysql.password,
  database : env.mysql.database
});

let roles = new Map(); // Roles will be sorted by role ID
let specialRoles = new Map();
let sticky = new Map();

function removeSticky(cid){
    connection.query("DELETE FROM sticky WHERE cid = ?", [cid], (err, results, fields) => {
        if(err) console.error("Something went wrong while removing a sticky message =>\n"+err);

        if(results.affectedRows > 0){
            sticky.delete(cid);
        }
    });
}
function addSticky(message, content){
    // Add or update sticky in the database
    connection.query("REPLACE INTO sticky VALUES(NULL, ?, ?, DEFAULT, ?, ?) ", [message.channel.id, message.id, content, message.author.id], (err, results, fields) => {
        if(err) console.error("Error while inserting a new sticky message =>\n"+err);
        // If we changed anything proceed
        if(results.affectedRows > 0){
            // Create a new embed
            let s = new Discord.MessageEmbed().setAuthor(message.member.displayName).setTimestamp(new Date()).setDescription(content).setFooter("Sticky message");
            // Send it to the correct channel
            message.channel.send(s).then((m) => {
                //If the send is successfull, add it to our local sticky Map.
                sticky.set(m.channel.id, m);
            }).catch((e) => {console.error("Something happened while sending sticky message =>\n"+e)});
        } else sendMessage(message, errorMessage("Something happened while trying to create a new sticky message. Try again?"), false);
    });
}
function displayInfo(member){
    let promise = new Promise((resolve, reject) => {
        connection.query("SELECT * FROM warns WHERE uid = ?", [member.id], (err, results, fields) => {
            if(err) reject(err);

            let info = new Discord.MessageEmbed();
            if(results.length > 0){
                for(let i = 0; i < results.length; i++){
                    info.addField("[#"+results[i].id+"], issued by "+member.guild.members.get(results[i].issued_by), results[i].reason);

                    if(i == results.length - 1){
                        resolve(info);
                    }
                }
            } else resolve(null);
        });
    });
}
function checkPermissions(member){
    let promise = new Promise((resolve, reject) => {
        roles.forEach((value, key, map) => {
            if(member.roles.cache.has(key)){
                resolve(value);
            }
        });

        reject(null);
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

function sendMessage(to, content, private){ //If we want to send a private message, we pass user, otherwise pass message
    if(private){
        to.send(content).catch((e) => {console.error("Error while sending private message =>\n"+e)});
    } else {
        to.channel.send(content).catch((e) => {console.error("Error while sending public message =>\n"+e)});;
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

function scheduleUnmute(){
    connection.query("SELECT TOP 1 * FROM mutes WHERE duration < ? AND active = 1 ORDER BY duration DESC", [new Date()], (err, results, fields) => {
        if(err) console.error("Something went wrong while scheduling unmute =>\n"+err);

        if(results.length > 0){
            let when = new Date(results[0].duration);
            let uid = results[0].uid;
            let member = client.users.cache.get(uid);

            let unmute = schedule.scheduleJob(when, () => {
            connection.query("UPDATE mutes SET active = 0 WHERE uid = ?", [member.id], (err, results, fields) => {
                if(err) throw err;
                if(results.affectedRows > 0){
                    member.roles.remove(specialRoles.get("mute"));
                    sendMessage(member, successMessage("You've been unmuted from "+member.guild.name+"."), true);
                } //Else it does not exist, maybe previously deleted.
            });
    });
        }
    });
    
}
function scheduleUnban(){
    let unban = schedule.scheduleJob(when, () => {
        connection.query("DELETE FROM bans WHERE uid = ?", [member.id], (err, results, fields) => {
            if(err) throw err;
            if(results.affectedRows > 0){
                member.guild.unban(member.id, "Ban time expired.").then((r) => {
                    member.guild.channels.cache.first().createInvite({"maxUses":1, "reason":"Re-invite"}).then((invite) => {
                        sendMessage(member, successMessage("You've been unbanned from "+member.guild.name+". Feel free to join again:\n"+invite.url), true);
                    }).catch((e) => {console.log(e)}); 
                }).catch((e) => {console.log(e)});

            } //Else it does not exist, maybe previously deleted.
        });
    });
}
function loadSticky(){
    sticky.clear();
    connection.query("SELECT cid, mid FROM sticky", [], (err, results, fields) => {
        if(err) console.error("Error while loading sticky data =>\n"+e);
        console.log(results);
        if(results.length > 0){
            for(let i = 0; i < results.length; i++){
                let c = client.channels.cache.get(results[i].cid);

                if(c != null && c != undefined){
                    let m = c.messages.cache.get(results[i].mid);
                    if(m != null && m != undefined){
                        sticky.set(m.channel.id, m.content);
                    }
                }
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
  
  //When our bot is ready, we can begin our regular checks to see if some of our timers have expired
    //In case any of the timers expired we can send an invite link to the user that was punished, or clear any restrictions on user


});
// Create an event listener for messages
client.on('message', message => {

    if(sticky.size > 0){ //If there are sticky messages.
    // We need to check if the message is actually a sticky message sent from the bot, if it is not we proceed
        if(message.embeds == null || message.embeds == undefined || message.embeds.length == 0 || message.embeds[0].footer.text != "Sticky message"){
            let m = sticky.get(message.channel.id);
            if(m != null && m != undefined){
                m.channel.send(m.embeds[0]).then((nm) => {
                    sticky.set(message.channel.id, nm);
                    m.delete();
                }).catch((e) => {console.error("Error while replacing sticky message =>\n"+e)});
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

        if(instruction[0] == "add" && message.author.id == message.guild.ownerID){ //Only owner can issue this command
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
                
                if(kick == 0 && ban == 0 && warn == 0 && mute == 0){
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
        } else if(instruction[0] == "remove"){
            if(instruction[1] == "sticky"){
                checkPermissions(message.member).then((value) => {
                    if(value.sticky == 1){
                        removeSticky(message.channel.id);
                    } else sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"remove sticky`"), false);
                }).check(() => {sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"remove sticky`"), false)})
            }
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
                if(value.warn == 1){
                        //They have permissions.
                        //Now we can check if they composed the message properly
                        if(instruction [1] == "remove" || instruction[1] == "r" || instruction[1] == "rm"){
                            if(instruction[3] != undefined && instruction[3] != null && !isNaN(instruction[3])){ //If they inserted the warn id and if it is a number
                                connection.query("DELETE FROM warns WHERE uid = ? AND id = ?", [message.mentions.members.first().id, instruction[3]], (err, results, fields) => {
                                    if(err) throw err;
                                    if(results.affectedRows > 0){
                                        sendMessage(message, successMessage("Successfully removed warning #"+instruction[3]+" from user "+message.mentions.members.first().displayName), false);
                                    } else sendMessage(message, errorMessage("Could not find warning ID #"+instruction[3]), false);
                                });
                            } else { //They did not enter a valid value as the warn id
                                //Display warn data for user
                                //Let them know to enter the command again.
                            }
                        } else if(message.mentions != null && message.mentions != undefined && message.mentions.members != null && message.mentions.members != undefined){
                            let warning = message.content.split(instruction[1]);
                            //Let's just send them a message first, just in case something goes wrong with inserting into db. They don't need to know we have db problems :D
                            sendMessage(message.mentions.members.first(), warnMessage(warning[1]).addField("Sent by: ", message.member.displayName), true);
                            connection.query("INSERT INTO warns VALUES(NULL, ?, DEFAULT, ?, ?)", [message.mentions.members.first().id, warning[1], message.author.id], (err, results, fields) => {
                                if(err) throw err;
                                if(results.affectedRows > 0){
                                    sendMessage(message, successMessage("Successfully warned user **"+message.mentions.members.first().displayName+"**").addField("Reason", warning[1], false), false);
                                }
                            });

                        } else sendMessage(message, errorMessage("You need to mention a member in order to warn them!"), false);

                    } else sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"warn`"), false);
            }).catch(() => { sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"warn`"), false)});
        } else if(instruction[0] == "mute"){
            //mute @user -time reason
            if(specialRoles.has("mute")){
                checkPermissions(message.member).then((value) => {
                    if(value.mute == 1){
                            //They have permissions.
                            //Now we can check if they composed the message properly
                            if(message.mentions != null && message.mentions != undefined && message.mentions.members != null && message.mentions.members != undefined){
                                connection.query("SELECT * FROM mutes WHERE uid = ?", [message.mentions.members.first().id], (err, results, fields) => {
                                    if(err) throw err;

                                    if(results.length > 0){
                                        sendMessage(message, errorMessage("This user is already muted!"), false);
                                    } else {
                                        if(instruction[2][0] == "-"){
                                            let string = instruction[2].split("-")[1];
                                            let until = stringToDateTime(string);
                                            connection.query("INSERT INTO mutes VALUES (NULL, ?, DEFAULT, ?, ?, ?)", [message.mentions.members.first().id, until, message.content.split(instruction[2])[1].trim(), message.member.id], (err, results, fields) => {
                                                if(err) throw err;
                                                if(results.affectedRows > 0){
                                                    //Successfully muted user, notify user, notify admin/mod, create schedule to remove mute
                                                    sendMessage(message.mentions.members.first(), infoMessage("You've been muted on "+message.guild.name+".").addField("Duration: ", until).addField("Reason: ", message.content.split(instruction[2])[1].trim()), true);
                                                    sendMessage(message, successMessage("User "+message.mentions.members.first().displayName+" successfully muted!"), false);

                                                    message.mentions.members.first().roles.add(specialRoles.get("mute"));

                                                    scheduleUnmute();
                                                    return;

                                                }
                                            });
                                        } else {
                                            connection.query("INSERT INTO mutes VALUES (NULL, ?, DEFAULT, ?, ?, ?", [message.mentions.members.first().id, new Date(), message.content.split(instruction[2])[1].trim(), message.member.id], (err, results, fields) => {
                                                    if(err) throw err;
                                                    if(results.affectedRows > 0){
                                                        sendMessage(message.mentions.members.first(), infoMessage("You've been muted on "+message.guild.name+".").addField("Duration: ", "Until unmuted.").addField("Reason: ", message.content.split(instruction[2])[1].trim()), true);
                                                        sendMessage(message, successMessage("User "+message.mentions.members.first().displayName+" successfully muted!"), false);

                                                        message.mentions.members.first().roles.add(specialRoles.get("mute"));
                                                        return;
                                                    }
                                            });
                                        }
                                    }
                                });
                            } else sendMessage(message, errorMessage("You need to mention a member in order to mute them!"), false);
                        } else sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"mute`"), false);
                }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"mute`"), false);});
            }
            
        } else if(instruction[0] == "unmute"){
            checkPermissions(message.member).then((value) => {
                if(value.mute == 1){ //If they have the role, and permissions to mute
                    if(message.mentions != null && message.mentions != undefined && message.mentions.roles != null && message.mentions.roles != undefined){
                        connection.query("DELETE FROM mutes WHERE uid = ?", [message.mentions.members.first().id], (err, results, fields) => {
                            if(err) throw err;
                            if(results.affectedRows > 0){
                                sendMessage(message, successMessage("Successfully unmuted user "+message.mentions.members.first().displayName, false));
                                message.mentions.members.first().roles.remove(specialRoles.get("mute"));
                                sendMessage(message.mentions.members.first(), successMessage("You've been unmuted from "+message.guild.name+"."), true);
                            }
                        });
                    } else sendMessage(message, errorMessage("You need to mention a member in order to mute them!"), false);
                } else sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"mute`"), false);
            }).catch(()=>{sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"mute`"), false);});
        } else if(instruction[0] == "kick" || instruction[0] == "k"){
            checkPermissions(message.member).then((value) => {
                if(value.kick == 1){ //If they have the role, and permissions to mute
                    if(message.mentions != null && message.mentions != undefined && message.mentions.roles != null && message.mentions.roles != undefined){
                        if(message.member.roles.highest.comparePositionTo(message.mentions.members.first().roles.highest) > 0){
                            let reason = message.content.split(instruction[1])[1].trim();
                            connection.query("INSERT INTO kicks VALUES (NULL, ?, DEFAULT, ?, ?)", [message.mentions.members.first().id, reason, message.author.id], (err, results, fields) => {
                                if(err) throw err;
                                if(results.affectedRows > 0){
                                    message.mentions.members.first().kick(reason).then((response) => {
                                        //success kick
                                    }).catch((e) => console.log(e));
                                } else sendMessage(message, errorMessage("Something went wrong while trying to kick this member."), false);
                            });
                        } else sendMessage(message, errorMessage("Cannot kick. This member has higher priviledges than you."), false);
                    } else sendMessage(message, errorMessage("You need to mention a member you want to kick first!"), false)
                } else sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"kick`"), false);
            }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"kick`"), false);});
        } else if(instruction[0] == "ban" || instruction[0] == "b"){
            checkPermissions(message.member).then((value) => {
                if(value.ban == 1){ //If they have the role, and permissions to mute
                    if(message.mentions != null && message.mentions != undefined && message.mentions.roles != null && message.mentions.roles != undefined){
                        if(message.member.roles.highest.comparePositionTo(message.mentions.members.first().roles.highest) > 0){
                            let until = null;
                            if(instruction[2][0] == "-"){
                                let string = instruction[2].split("-")[1];
                                until = stringToDateTime(string);
                            } 
                            let reason = message.content.split(instruction[3])[1].trim();
                            if(message.mentions.members.first().bannable){
                                connection.query("INSERT INTO bans VALUES (NULL, ?, DEFAULT, ?, ?, ?)", [message.mentions.members.first().id, until, reason, message.author.id], (err, results, fields) => {
                                    if(err) throw err;
                                    if(results.affectedRows > 0){
                                        message.mentions.members.first().ban({"reason":reason}).then((response) => {
                                            if(until != null){
                                                scheduleUnban();
                                            }
                                        }).catch((e) => console.log(e));
                                    } else sendMessage(message, errorMessage("Something went wrong while trying to ban this member."), false);
                                });
                            } else sendMessage(message, errorMessage("This member is not bannable."), false);
                        } else sendMessage(message, errorMessage("Cannot ban. This member has higher priviledges than you."), false);
                    } else sendMessage(message, errorMessage("You need to mention a member you want to ban first!"), false)
                } else sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"ban`"), false);
            }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"ban`"), false)});
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
        } else if(instruction[0] == "test"){
            message.reply("🦄");
        } else if(instruction[0] == "info"){
            if(message.mentions != null && message.mentions != undefined && message.mentions.roles != null && message.mentions.roles != undefined){
                checkPermissions(message.member).then((value) => {
                    message.channel.send(displayInfo(message.mentions.members.first())).catch((e) => {console.error("Error while trying to send message =>\n"+e)});
                }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"info`"), false)});
            } else sendMessage(message, errorMessage("You need to mention a user to check their info first."), false);
        } else if(instruction[0] == "sticky"){
            if(message.mentions != null && message.mentions != undefined && message.mentions.roles != null && message.mentions.roles != undefined){
                let content = message.content.split(env.prefix+""+instruction[0])[1];
                if(content != null && content != undefined && content.length > 0){
                    checkPermissions(message.member).then((value) => {
                        addSticky(message, content);
                    }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"sticky`"), false)})
                } else sendMessage(message, errorMessage("You cannot set an empty sticky message!"),false);
            }
        }
    }

});

client.login(env.token);