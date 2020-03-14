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
        to.send(content);
    } else {
        to.reply(content);
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
function scheduleUnmute(member, when){
    let unmute = schedule.scheduleJob(when, () => {
        connection.query("DELETE FROM mutes WHERE uid = ?", [member.id], (err, results, fields) => {
            if(err) throw err;
            if(results.affectedRows > 0){
                member.roles.remove(specialRoles.get("mute"));
                sendMessage(member, successMessage("You've been unmuted from "+member.guild.name+"."), true);
            } //Else it does not exist, maybe previously deleted.
        });
    });
}
function scheduleUnban(member, when){
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
function loadRoles(){
    roles.clear();
    connection.query("SELECT rid, kick, ban, warn, mute FROM permissions", [], (err, results, fields) => {
      if(err) throw err; //If there is an error for some reason throw it ( to console usually ) 

      if(results != null && results != undefined){ //If we get any results. Probably will once everything is setup
        for(let i = 0; i < results.length; i++){ //Let's loop through our results, format them and place them in our variable
            roles.set(results[i].rid, {"kick":results[i].kick, "ban":results[i].ban, "mute":results[i].mute, "warn":results[i].warn});
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
  //When our bot is ready, we can begin our regular checks to see if some of our timers have expired
    //In case any of the timers expired we can send an invite link to the user that was punished, or clear any restrictions on user


});
// Create an event listener for messages
client.on('message', message => {

    if(message.content[0] == env.prefix){ //If our message starts with a prefix
        let instruction = message.content.substr(1); //Then let's remove the prefix and store it in instruction variable
        instruction = instruction.trim().toLowerCase().split(" "); //Let's just trim excess whitespaces, move everything to lowercase and split the instruction by whitespaces
        //Now we can do our regular checks.

        //Add and remove roles that can be administrators/moderators
            //Set permissions for roles such as kick, ban, warn, mute
        //Kick, ban, warn, mute commands

        if(instruction[0] == "add" && message.author.id == message.guild.ownerID){ //Only owner can issue this command
            if(instruction[1][0] == "-"){
                let kick = 0, ban = 0, warn = 0, mute = 0;

                if(instruction[1].includes("k"))
                    kick = 1;
                if(instruction[1].includes("b"))
                    ban = 1;
                if(instruction[1].includes("w"))
                    warn = 1;
                if(instruction[1].includes("m"))
                    mute = 1;
                
                if(kick == 0 && ban == 0 && warn == 0 && mute == 0){
                    sendMessage(message, errorMessage("Cannot add roles without permissions."), false);
                } else {
                    if(message.mentions != null && message.mentions != undefined && message.mentions.roles != null && message.mentions.roles != undefined){ // If there are roles mentioned
                        message.mentions.roles.each((role) => {
                            if(!roles.has(role.id)){
                                connection.query("INSERT INTO permissions VALUES (NULL, ?, DEFAULT, ?, ?, ?, ?)", [role.id, mute, kick, warn, ban], (err, results, fields) => {
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
            roles.forEach((value, key, map) => {
                if(message.member.roles.cache.has(key)){
                    //They have the role we have registered, now let's check if they have permissions to do this.
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
                            sendMessage(message.mentions.members.first(), warnMessage(warning[1]), true);
                            connection.query("INSERT INTO warns VALUES(NULL, ?, DEFAULT, ?, ?)", [message.mentions.members.first().id, warning[1], message.author.id], (err, results, fields) => {
                                if(err) throw err;
                                if(results.affectedRows > 0){
                                    sendMessage(message, successMessage("Successfully warned user **"+message.mentions.members.first().displayName+"**").addField("Reason", warning[1], false), false);
                                }
                            });

                        } else sendMessage(message, errorMessage("You need to mention a member in order to warn them!"), false);

                    } else sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"warn`"), false);
                }
            });
        } else if(instruction[0] == "mute"){
            //mute @user -time reason
            if(specialRoles.has("mute")){
                roles.forEach((value, key, map) => {
                    if(message.member.roles.cache.has(key)){
                        //They have the role we have registered, now let's check if they have permissions to do this.
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

                                                    scheduleUnmute(message.mentions.members.first(), until);

                                                }
                                            });
                                        } else {
                                            connection.query("INSERT INTO mutes VALUES (NULL, ?, DEFAULT, ?, ?, ?", [message.mentions.members.first().id, new Date(), message.content.split(instruction[2])[1].trim(), message.member.id], (err, results, fields) => {
                                                    if(err) throw err;
                                                    if(results.affectedRows > 0){
                                                        sendMessage(message.mentions.members.first(), infoMessage("You've been muted on "+message.guild.name+".").addField("Duration: ", "Until unmuted.").addField("Reason: ", message.content.split(instruction[2])[1].trim()), true);
                                                        sendMessage(message, successMessage("User "+message.mentions.members.first().displayName+" successfully muted!"), false);

                                                        message.mentions.members.first().roles.add(specialRoles.get("mute"));
                                                    }
                                            });
                                        }
                                    }
                                });
                            } else sendMessage(message, errorMessage("You need to mention a member in order to mute them!"), false);
                        } else sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"mute`"), false);
                    }
                });
            }
            
        } else if(instruction[0] == "unmute"){
            roles.forEach((value, key, map) => { //Again, checking our roles
                if(message.member.roles.cache.has(key)){ //For the roles a member issuing this command has
                    if(value.mute == 1){ //If they have the role, and permissions to mute
                        if(message.mentions != null && message.mentions != undefined && message.mentions.roles != null && message.mentions.roles != undefined){
                            connection.query("DELETE FROM mutes WHERE uid = ?", [message.mentions.members.first().id], (err, results, fields) => {
                                if(err) throw err;
                                if(results.affectedRows > 0){
                                    sendMessage(message, successMessage("Successfully unmuted user "+message.mentions.members.first().displayName, false));
                                    message.mentions.members.first().roles.remove(specialRoles.get("warn"));
                                    sendMessage(message.mentions.members.first(), successMessage("You've been unmuted from "+member.guild.name+"."), true);
                                }
                            });
                        } else sendMessage(message, errorMessage("You need to mention a member in order to mute them!"), false);
                    } else sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"mute`"), false);
                }
            });
        } else if(instruction[0] == "kick" || instruction[0] == "k"){
            roles.forEach((value, key, map) => { //Again, checking our roles
                if(message.member.roles.cache.has(key)){ //For the roles a member issuing this command has
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
                            } else sendMessage(message, errorMessage("Cannot kick. This user has higher priviledges than you."), false);
                        }
                    }
                }
            });
        } else if(instruction[0] == "ban" || instruction[0] == "b"){
            roles.forEach((value, key, map) => { //Again, checking our roles
                if(message.member.roles.cache.has(key)){ //For the roles a member issuing this command has
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
                                                    scheduleUnban(until);
                                                }
                                            }).catch((e) => console.log(e));
                                        } else sendMessage(message, errorMessage("Something went wrong while trying to kick this member."), false);
                                    });
                                } else sendMessage(message, errorMessage("This member is not bannable."), false);
                            } else sendMessage(message, errorMessage("Cannot kick. This user has higher priviledges than you."), false);
                        }
                    }
                }
            });
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
        }
    }

});

client.login(env.token);