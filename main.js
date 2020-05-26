const Discord = require('discord.js');
let schedule = require('node-schedule');
const request = require('request');
var moment = require('moment');
let pm2 = require('pm2');

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
let keywords = new Map();
let welcomeMessage = null;

let blockedSticky = new Map();
let spamList = new Map();

let spamIgnoreChannels = new Map();

let defaultChannel;
let messageLogChannel = null;

let whitelistChannel = null;
var uptime = "00h 00m";

// Server status monitor vars
var t = null
var r = null

let oneAM = new Date();
let sevenAM = new Date();
let onePM = new Date();
let sevenPM = new Date();

let nextRestart, lastRestart;
function denyWhitelist(message, member, steamid){
	if(steamid.length > 0){
        connection.query("INSERT INTO steamid VALUES (null, ?, ?, default, default, ?) ON DUPLICATE KEY UPDATE mid = ?, addedby = ?, steamid = ?, whitelist = 0", [steamid, member.id, message.author.id, member.id, message.author.id, steamid], (err, results, fields) => {
            if(err) throw err;

            if(results.affectedRows > 0){
                whitelistChannel.send(`Your whitelist has been **denied** by ${message.author.username} - ${steamid}`, {reply:member.id});
				message.delete();
            } else sendMessage(message, errorMessage("Something went wrong while inserting steam id."), false);
        });
    } else sendMessage(message, errorMessage("Something went wrong while inserting steam id."), false);
}
function whitelist(message, member, steamid){
	if(steamid.length > 0){
        connection.query("INSERT INTO steamid VALUES (null, ?, ?, default, 1, ?) ON DUPLICATE KEY UPDATE mid = ?, addedby = ?, steamid = ?", [steamid, member.id, message.author.id, member.id, message.author.id, steamid], (err, results, fields) => {
            if(err) throw err;

            if(results.affectedRows > 0){
                whitelistChannel.send(`Your whitelist has been **approved** by ${message.author.username} - ${steamid}`, {reply:member.id});
				member.roles.add("714214262188277890");
				message.delete();
            } else sendMessage(message, errorMessage("Something went wrong while inserting steam id."), false);
        });
    } else sendMessage(message, errorMessage("Something went wrong while inserting steam id."), false);
}
function removeSteam(message, member){
    if(member instanceof Discord.GuildMember){
        connection.query("DELETE FROM steamid WHERE mid = ?", [member.id], (err, results, fields) => {
            if(err) throw err;

            if(results.affectedRows > 0){
                sendMessage(message, successMessage("Successfully removed steamID."), false);
            } else sendMessage(message, errorMessage("Something went wrong while deleting steamID. Maybe it doesn't exist?"), false);
        })
    } else {
        connection.query("DELETE FROM steamid WHERE steamid = ?", [member], (err, results, fields) => {
            if(err) throw err;

            if(results.affectedRows > 0){
                sendMessage(message, successMessage("Successfully removed steamID."), false);
            } else sendMessage(message, errorMessage("Something went wrong while deleting steamID. Maybe it doesn't exist?"), false);
        })
    }
}
function viewSteam(message, member){
	if(member instanceof Discord.GuildMember){
		connection.query("SELECT * FROM steamid WHERE mid = ?", [member.id], (err, results, fields) => {
			if(err) throw err;

			if(results.length > 0){
				const embed = new Discord.MessageEmbed()
				.setDescription(`**SteamID for member**: <@${member.id}>\n${results[0].steamid}`)
				.setTimestamp(new Date())
				.setFooter(`Added by ${results[0].addedby}`, "https://cdn3.iconfinder.com/data/icons/popular-services-brands-vol-2/512/steam-512.png");

				if(results[0].whitelist == 1){
					embed.addField("Whitelisted", "True");
				} else {
					embed.addField("Whitelisted", "False");
				}
				sendMessage(message, embed, false);
			} else sendMessage(message, errorMessage("No records found."), false);
		});
	} else {
		connection.query("SELECT * FROM steamid WHERE steamid = ?", [member], (err, results, fields) => {
			if(err) throw err;

			if(results.length > 0){
				const embed = new Discord.MessageEmbed()
				.setDescription(`**SteamID for member**: <@${member.id}>\n${results[0].steamid}`)
				.setTimestamp(new Date())
				.setFooter(`Added by ${results[0].addedby}`, "https://cdn3.iconfinder.com/data/icons/popular-services-brands-vol-2/512/steam-512.png");
				if(results[0].whitelist == 1){
					embed.addField("Whitelisted", "True");
				} else {
					embed.addField("Whitelisted", "False");
				}
				sendMessage(message, embed, false);
			} else sendMessage(message, errorMessage("No records found."), false);
		});
	}
}
function addSteam(message, member, steamid){
    if(steamid.length > 0){
        connection.query("INSERT INTO steamid VALUES (null, ?, ?, default, default, ?) ON DUPLICATE KEY UPDATE mid = ?, addedby = ?, steamid = ?", [steamid, member.id, message.author.id, member.id, message.author.id, steamid], (err, results, fields) => {
            if(err) throw err;

            if(results.affectedRows > 0){
                sendMessage(message, successMessage("Successfully added steamID to user."), false);
            } else sendMessage(message, errorMessage("Something went wrong while inserting steam id."), false);
        });
    } else sendMessage(message, errorMessage("Something went wrong while inserting steam id."), false);
}
function createDonorRequest(message, request, member){
    connection.query("INSERT INTO requests VALUES(null, ?, ?, default, null, default, null, null)", [member.id, request], (err, results, fields) => {
        if(err) throw err;

        if(results.affectedRows > 0){
            connection.query("SELECT id FROM requests WHERE mid = ? ORDER BY date DESC LIMIT 1", [member.id], (e, r, f) => {
                if(e) throw e;
                if(r.length > 0){
                    let req = JSON.parse(request);
                    let embed = new Discord.MessageEmbed()
                    .setTitle(`Donator request #${r[0].id}`)
                    .setDescription(`**Request by:**<@${member.id}>\n**Content**:\n${req.content}`)
                    .setTimestamp(new Date())
                    .setFooter("Sent: ")
                    .setColor(0xff8307);

                    let channel = message.guild.channels.cache.get("711999251797770295");

						channel.send(embed).then((m) => {
							connection.query("UPDATE requests SET message = ? WHERE id = ?", [m.id, r[0].id], (er, res, fie) => {
								if(er) throw er;
							})
						});
						
					message.delete();
                } else sendMessage(member, errorMessage("Something went wrong while sending the request. Try again?"), false);
            });
            sendMessage(message, successMessage("Request successfully sent.\nPlease be patient as the request needs some time to be reviewed."), false, null, null, 10000);


        } else sendMessage(message, errorMessage("Something went wrong while sending the request. Try again?"), false);
    });
}
function approveDonorRequest(message, id, reason){
	if(reason == null)
		reason = "Approved."
    connection.query("UPDATE requests SET status = 2, reason = ?, handledBy = ? WHERE id = ?", [reason, message.author.id, id], (err, results, fields) => {
        if(err) throw err;

        if(results.affectedRows > 0){
            connection.query("SELECT mid, message FROM requests WHERE id = ?", [id], (e, r, f) => {
                if(e) throw e;

                if(r.length > 0){
                    let embed = new Discord.MessageEmbed()
                    .setTitle(`Donator request #${id}`)
					.setDescription(reason)
                    .addField("Approved by", message.author.tag)
                    .setTimestamp(new Date())
                    .setColor(0x28a745);
        
                    let channel = message.guild.channels.cache.get("711999192301830184");
					let channel2 = message.guild.channels.cache.get("711999251797770295");
        
                    channel.send({reply:r[0].mid});
					channel.send(embed);
					message.delete();
					channel2.messages.delete(r[0].message);
                } else sendMessage(message, errorMessage("Something went wrong while approving request. Try again?"), false);
            })
        } else sendMessage(message, errorMessage("Something went wrong while approving request. Try again?"), false);
    });
}
function denyDonorRequest(message, id, reason){
    connection.query("UPDATE requests SET status = 1, reason = ?, handledBy = ? WHERE id = ?", [reason, message.author.id, id], (err, results, fields) => {
        if(err) throw err;

        if(results.affectedRows > 0){
            connection.query("SELECT mid, message FROM requests WHERE id = ?", [id], (e, r, f) => {
                if(e) throw e;

                if(r.length > 0){
                    let embed = new Discord.MessageEmbed()
                    .setTitle(`Donator request #${id} denied.`)
                    .addField("Denied by", message.author.tag)
                    .setDescription(reason)
                    .setTimestamp(new Date())
                    .setColor(0xdc3545);
        
                    let channel = message.guild.channels.cache.get("711999192301830184");
					let channel2 = message.guild.channels.cache.get("711999251797770295");
        
                    channel.send({reply:r[0].mid});
					channel.send(embed);
					message.delete();
					channel2.messages.delete(r[0].message);
                } else sendMessage(message, errorMessage("Something went wrong while denying request. Try again?"), false);
            })
        } else sendMessage(message, errorMessage("Something went wrong while denying request. Try again?"), false);
    });
}
function createNote(message, note, member){
    connection.query("INSERT INTO notes VALUES(null, ?, ?, default, ?)", [member.id, note, message.author.id], (err, results, fields) => {
        if(err) throw err;

        if(results.affectedRows > 0){
            sendMessage(message, successMessage(`Successfully added note to user ${member.user.tag}.`), false);
        } else sendMessage(message, errorMessage("Something went wrong while creating note."), false);
    });

}
function removeNote(message, id){
    connection.query("DELETE FROM notes WHERE id = ?", [id], (err, results, fields) => {
        if(err) throw err;

        if(results.affectedRows > 0){
            sendMessage(message, successMessage("Successfully removed note."), false);
        } else sendMessage(message, errorMessage("Something went wrong while removing note."), false);
    });
}
function viewNotes(message, member){
    connection.query("SELECT * FROM notes WHERE mid = ?", [member.id], (err, results, fields) => {
        if(err) throw err;

        if(results.length > 0){
            let embed = new Discord.MessageEmbed()
            .setTitle(`Notes for user ${member.user.username}`)
            .setColor(0xff8307);
            for(let i = 0; i < results.length; i++){
                embed.addField(`[#${results[i].id}] - Note by ${results[i].by}`, `${results[i].note}\n*${moment(results[i].date).format("dddd, MMMM Do YYYY, h:mm:ss a")}*`);

                if(i == results.length - 1){
                    sendMessage(message, embed, false);
                }
            }
        } else sendMessage(message, errorMessage("Could not find any notes for this member"), false);
    });
}
/**
 * Resolves a Discord.GuildMember or Discord.User from a given message.
 * @param {Discord.Message} message - The message from which a member or user will be resolved.
 * @param {string|number} expectedPosition - At which word the mention of a user is expected
 */
function resolveMember(message, expectedPosition){
    // This might take some time and we want to continue doing other things while we're searching.
    // Resolve returns a member/user or null
    // Reject error

    let promise = new Promise((resolve, reject) => {
        // Let's check if we have a mention first, as it is the simplest way of getting a member.
        if(message.mentions != null && message.mentions.members != null && message.mentions.users.size > 0){
            // We have a mention, let's see if it is a member or a user

            if(message.mentions.members.first() != null){
                // We have a member
                resolve(message.mentions.members.first());
            } else {
                // We have a user
                resolve(message.mentions.users.first());
            }
        } else {
            // We don't have a mention, so we will have to do a search
            let lookup = message.content.split(" ")[expectedPosition]; // This is our query parameter based on expected input
            let u = lookup;
            if(isNaN(lookup)){
                u = null;
            } else lookup = null;

            message.guild.members.fetch({user: u, query: lookup, limit:10}).then((members) => {

                if(members instanceof Discord.GuildMember){
                    resolve(members);
                } else if(members.size == 1){
                    // We have a single result, so we can just resolve here;
                    resolve(members.first());
                } else if(members.size == 0){
                    // No members found
                    resolve(null);
                } else {
                    // We have multiple results, so we will have to ask them for a choice.
                    // Let's just format a message first
                    message.channel.send(memberSelectionMessage(members));

                    let collector = new Discord.MessageCollector(message.channel, (m) => {
                        if(m.author.id == message.author.id){
                            if(!isNaN(m.content) && m.content > 0 && m.content <= members.size){
                                let i = 0;
                                let nr = parseInt(m.content);
                                members.some((member) => {
                                    if(i == nr - 1){
                                        resolve(member);
                                        return;
                                    } else i++;
                                });
                            } else collector.stop();
                        }
                    }, {time:10000}); // Wait 10 seconds before auto closing the collector

                }
            }).catch((e) => {
                console.error(e);
                reject(e);
            });
        }
    });
    return promise;
}
/**
 * Creates a Discord.RichEmbed as a way of presenting data to be selected by user
 * @param {Discord.GuildMember | Collection<GuildMember>} members - Returned guild member or a collection of guild members
 */
function memberSelectionMessage(members){
    let embed = new Discord.MessageEmbed()
    .setTitle("Multiple members found.")
    .setDescription("Please select a member from the list by responding with the # number.")
    .setTimestamp(new Date())
	.setColor(0xff8307)
    .setFooter("User search", "https://cdn.discordapp.com/app-icons/695719904095240203/52decf1ee25f52b003340ef78f31e511.png?size=256");

    let id = 1;
    members.each((value, key) => {
        embed.addField(`**[#${id}]** - UID: *${key}*`, value.user.tag);
        id++;
    });

    return embed;
}
/**
 * Coverts a number character to an emoji. Used for creating reactions
 * @param {string} c - A character from 0 to 9
 */
function charToEmoji(c){
	if(c == 0)
		return "0⃣";
	else if(c == 1)
		return "1⃣";
	else if(c == 2)
		return "2⃣";
	else if(c == 3)
		return "3⃣";
	else if(c == 4)
		return "4⃣";
	else if(c == 5)
		return "5⃣";
	else if(c == 6)
		return "6⃣";
	else if(c == 7)
		return "7⃣";
	else if(c == 8)
		return "8⃣";
	else if(c == 9)
		return "9⃣";
	else return null;
}
/**
 * Checks if a joining member has a previous mute and assigns the mute role back to them.
 * @param {Discord.GuildMember} member 
 */
function checkMuteStatus(member){
	connection.query("SELECT * FROM mutes WHERE uid = ? AND active = 1", [member.id], (err, results, fields) => {
		if(err) throw err;
		if(results.length > 0){
			// This member tried to evade a mute. Let's return his mute role and notify staff.
			member.roles.add(specialRoles.get("mute"));
			defaultChannel.send(warnMessage(`${member.user.tag} tried to evade a mute.`));
			scheduleUnmute();
		}
	});
}
/**
 * Anti spam functionality that checks a message for role tags, mass user tags and spam.
 * @param {Discord.Message} message - Message that will be checked for spam
 */
function antiSpam(message){
	const TIMELIMIT = 800;
	if(!message.author.bot){
		checkPermissions(message.member, "mute").then(() => {
			// They got the permissions, so we will just skip
		}).catch(() => {
				if(spamList.has(message.author.id)){
				let items = spamList.get(message.author.id);
					if(items.length >= 2){
					   if(moment(message.createdAt).diff(items[0]) <= TIMELIMIT){
							// We have 3 messages that are less than 2 seconds apart
							// Now we can mute and clear the queue for this user

							mute(message, moment().add(15, 'minutes').toDate(), "Anti-spam mute.", true);
							spamList.delete(message.author.id);
					   } else {
						   // There are more than 3 messages, but they are more than 2 seconds apart. We find this useless, so we will clear the spam list.
						   // However we will also add the current info

						   spamList.delete(message.author.id);
						   spamList.set(message.author.id, [new Date()]);
					   }
					} else {
						// We have less than 2 messages in, so let's just add a new date
						if(moment(items[items.length-1]).diff >= TIMELIMIT){
							spamList.delete(message.author.id);
							spamList.set(message.author.id, [message.createdAt]);
						} else {
							items.push(message.createdAt);
							spamList.set(message.author.id, items);
						}
					}
					} else { // First entry. We do not really care about it.
						spamList.set(message.author.id, [message.createdAt]);
					}
					
					if(message.mentions.everyone){
						mute(message, moment().add(1, 'hour').toDate(), "Anti-spam due to `everyone` or `here` mentions", true);
						return;
					}
					
					/*
					if(message.mentions.roles.size > 0){
						mute(message, moment().add(1, 'hour').toDate(), "Anti-spam mute due to mass role tag", true);
						return;
					}*/
					
					if(message.mentions.users.size > 3 && message.channel.id != "642864940708790282" && message.channel.id != "642413766775930891" && message.channel.id != "642417725385211956"){
						mute(message, moment().add(1, 'hour').toDate(), "Anti-spam mute due to tagging more than 3 users.", true);
						return;
					}
					
					spamList.forEach((value, key, map) => {
						// If our latest record for user is older than 3s, remove it
						if(moment(value[value.length-1]).diff(new Date()) > TIMELIMIT){
							spamList.delete(key);
						}
					});
					
					if(message.mentions.users.size > 0 && (message.channel.id == "642413498437206016" || message.channel.id == "699621179249524747")){
						message.mentions.users.some((u) => {
							if(u.id == "283424515160014857"){
								mute(message, moment().add(15, 'minutes').toDate(), "You tried to tag Ramp, silly.", true);
								return true;
							}
						});
					}
		});	
	}
}
/**
 * Generates a Discord.RichEmbed of whois information for a user
 * @param {Discord.GuildMember} member - Member whos data will be presented
 */
function whois(member){    
    const embed = new Discord.MessageEmbed()
    .setAuthor(member.user.tag, member.user.avatarURL())
    .setThumbnail(member.user.avatarURL())
    .setColor(0xff8307)
    .setTitle("Whois results for user: "+member.user.username)
    .setTimestamp(new Date())
    .setFooter("Results provided by PhoenixRP bot.", "https://cdn.discordapp.com/app-icons/695719904095240203/52decf1ee25f52b003340ef78f31e511.png?size=256")
    .addField("**User ID**:", member.id)
    .addField("**Joined Discord**: ", moment(member.user.createdAt).format("MMMM Do YYYY, h:mm:ss a")+" - "+moment(member.user.createdAt).fromNow())
    .addField("**Joined server**: ", moment(member.joinedAt).format("MMMM Do YYYY, h:mm:ss a")+" - "+moment(member.joinedAt).fromNow())
    .addField("**Highest role**: ", member.roles.highest.name);
	
	if(member.lastMessage != null && member.lastMessage.createdAt != null){
		embed.addField("**Last message**: ", moment(member.lastMessage.createdAt).format("MMMM Do YYYY, h:mm:ss a")+" - "+moment(member.lastMessage.createdAt).fromNow());
	} else embed.addField("**Last message**: ", "Not found.");
    return embed;
    
}
/**
 * Removes the welcome message that was previously set
 * @param {Discord.Message} message 
 */
function removeWelcome(message){
    connection.query("DELETE FROM messages WHERE type = 'welcome'", [], (err, results, fields) => {
        if(err) console.error(err);
        if(results && results.affectedRows > 0){
            sendMessage(message, successMessage("Successfully removed welcome message."), false);
            welcomeMessage = null;
        } else sendMessage(message, errorMessage("Something went wrong while deleting a welcome message. Perhaps it doesn't exist?"), false);
    });
}
/**
 * Loads the welcome message from the database into a local variable
 */
function loadWelcome(){
    connection.query("SELECT message FROM messages WHERE type = 'welcome'", [], (err, results, fields) => {
        if(err) console.error(err);

        if(results && results.length > 0){
            welcomeMessage = results[0].message;
        }
    });
}
/**
 * Based on the instruction from the message, sets a new welcome message that will be sent to each new discord server member
 * @param {Discord.Message} message 
 */
function setWelcome(message){
    connection.query("REPLACE INTO messages VALUES(null, ?, 'welcome', ?, default, ?)", [message.guild.id, message.content.split(env.prefix+"welcome ")[1], message.author.id], (err, results, fields) => {
        if(err) console.error(err);

        if(results != null && results.affectedRows > 0){
            welcomeMessage = message.content.split(env.prefix+"welcome ")[1];
            sendMessage(message, successMessage("Successfully set welcome message!"), false);
        } else sendMessage(message, errorMessage("Something went wrong while setting a welcome message. Try again?"), false);
    });
}
/**
 * @author Traktoorn, modified by gee
 */
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
                            client.user.setActivity(`${guild.memberCount} PhoenixRP members!`, { type: 'WATCHING' });
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
                        }, 5000)
                    }).catch((error) => { console.log("something went wrong\n"+error) });
}
/**
 * Loads the default channel from the database into a local variable
 */
function loadDefaultChannel(){
	connection.query("SELECT * FROM default_channel", [], (err, results, fields) => {
		if(err) console.log("Error while getting default channel:\n"+err);

		if(results != null && results != undefined && results.length > 0){
            for(let i = 0; i < results.length; i++){
                if(results[i].type == "log"){
                    defaultChannel = client.guilds.cache.first().channels.cache.get(results[i].rid);
                } else if(results[i].type = "mlog"){
                    messageLogChannel = client.guilds.cache.first().channels.cache.get(results[i].rid);
                }
            }		
		}
	});
}
/**
 * Assigns a muted role based on instructions from the message. It can have a duration or be permanent. It can have a reason.
 * @param {Discord.Message} message 
 * @param {Date | null} until 
 * @param {string} reason 
 * @param {boolean} auto 
 * @param {Discord.GuildMember} m 
 */
function mute(message, until, reason, auto, m){
    let untilString;
	let member;
	let issuedByID;
	
    if(until === null){
        until = new Date(0);
        untilString = "never";
    } else {
        untilString = moment().to(until);
    }
	
	if(auto != null){
		member = message.member;
		issuedByID = client.user.id;
	} else {
		member = m;
		issuedByID = message.member.id;
	}

    connection.query("INSERT INTO mutes VALUES (NULL, ?, DEFAULT, ?, ?, ?, 1)", [member.id, until, reason, issuedByID], (err, results, fields) => {
        if(err) throw err;
        if(results.affectedRows > 0){
            //Successfully muted user, notify user, notify admin/mod, create schedule to remove mute
            sendMessage(member, infoMessage("You've been muted on "+message.guild.name+".").addField("Expires: ", untilString).addField("Reason: ", reason), true);
            sendMessage(message, successMessage("User "+member.displayName+" successfully muted!\n**Expires:**\n"+untilString+"!\n**Reason**:\n"+reason), false, true, "mute");
            member.roles.add(specialRoles.get("mute"));

            scheduleUnmute();
			
			if(auto == null){
				message.delete();
			}
            
        }
    });
}
/**
 * Unmutes a user based on the mention in the message.
 * @param {Discord.Message} message 
 */
function unmute(message){
    connection.query("UPDATE mutes SET active = 0 WHERE uid = ?", [message.mentions.members.first().id], (err, results, fields) => {
        if(err) throw err;
        if(results.affectedRows > 0){
            sendMessage(message, successMessage("Successfully unmuted user "+message.mentions.members.first().displayName),false, true, "mute");
            message.mentions.members.first().roles.remove(specialRoles.get("mute"));
            sendMessage(message.mentions.members.first(), successMessage("You've been unmuted from "+message.guild.name+"."), true);
			scheduleUnmute();
        }
    });
}
/**
 * Warns a user based on instructions from the message
 * @param {Discord.Message} message - Message containing instructions and other data
 * @param {string} warning - Reason for warning the member
 * @param {Discord.GuildMember} member - Member to be warned
 */
function warn(message, warning, member){
    sendMessage(member, warnMessage(warning).addField("Sent by: ", message.member.displayName), true);
    connection.query("INSERT INTO warns VALUES(NULL, ?, DEFAULT, ?, ?)", [member.id, warning, message.author.id], (err, results, fields) => {
        if(err) throw err;
        if(results.affectedRows > 0){
            sendMessage(message, successMessage("Successfully warned user **"+member.displayName+"**\nReason:\n"+warning), false, true, "warn");
        }
    });
}
/**
 * Removes a warning from a user based on the instruction from the message
 * @param {Discord.Message} message 
 * @param {number} id 
 */
function removeWarning(message, id){
    connection.query("DELETE FROM warns WHERE id = ?", [id], (err, results, fields) => {
        if(err) throw err;
        if(results.affectedRows > 0){
            sendMessage(message, successMessage("Successfully removed warning #"+id), false, true, "warn");
        } else sendMessage(message, errorMessage("Could not find warning ID #"+instruction), false);
    });
}
/**
 * Kicks a user from the discord server.
 * @param {Discord.Message} message - A message containing instructions
 * @param {string} reason - Reason for kicking the member
 * @param {Discord.GuildMember} member - Member to be kicked
 */
function kick(message, reason, member){
    connection.query("INSERT INTO kicks VALUES (NULL, ?, DEFAULT, ?, ?)", [member.id, reason, message.author.id], (err, results, fields) => {
        if(err) throw err;
        if(results.affectedRows > 0){
            sendMessage(member, infoMessage("You've been kicked from "+message.guild.name+".\nIssued by "+message.author.displayName+"\n**Reason**\n"+reason), true);
            setTimeout(() => {
                member.kick(reason).then((response) => {
                    //success kick
                    sendMessage(message, successMessage(`User ${message.mentions.members.first().displayName} successfully kicked!\nReason\n${reason}`), false, true, "kick"); 
                }).catch((e) => console.log(e));
            }, 2000);
        } else sendMessage(message, errorMessage("Something went wrong while trying to kick this member."), false);
    });
}
/**
 * Bans a user from the discord server. Can be permanent or temporary.
 * @param {Discord.Message} message - Message containing the instruction and other important data
 * @param {Date | null} until  - Date until the ban will last or null for permanent
 * @param {string} reason - The reason for a ban.
 * @param {*} del - Data that signifies if a member should have their messages removed or not
 * @param {string} uid - User id, used in offline bans
 * @param {Discord.GuildMember} member - Member to be banned
 */
function ban(message, until, reason, del, uid, member){
    let untilString;
    if(until == null){
        untilString = "never";
        until = new Date(0);
    } else{
        untilString = moment().to(until);
    }

    if(del == null || del == undefined){
        del = 0;
    } else del = 7;

	if(uid == null){
		uid = member;
	}
    connection.query("INSERT INTO bans VALUES (NULL, ?, DEFAULT, ?, ?, ?, 1)", [(member == null) ? uid : uid.id, until, reason, message.author.id], (err, results, fields) => {
        if(err) throw err;
        if(results.affectedRows > 0){
            message.channel.createInvite({maxAge:0, maxUses:1, unique:true, reason:"Unban invite."}).then((invite) => {
				
				if(uid.id != null){
					sendMessage(uid, infoMessage("You've been banned from "+message.guild.name+". You can use the invite link once/if your ban expires.\n**Expires:**\n"+until+"\n**Banned by:**\n"+message.member.displayName+"\n**Reason:**\n"+reason), true);
					sendMessage(uid, invite.url, true);
				} 
                
                setTimeout(()=>{
                    message.guild.members.ban(uid, {"days":del, "reason":reason}).then((user)=>{
                        sendMessage(message, successMessage("Successfully banned user **"+user.user.tag+"**\n**Expires**:\n"+untilString+"\n**Reason:**\n"+reason), false, true, "ban");
                        scheduleUnban();
                    }).catch((e) => {console.error("Something happened while banning user =>\n"+e); sendMessage(message, errorMessage("Error while banning user."), false)})
                }, 1000);
            }).catch((e) => {console.error("Error while creating invite =>\n"+e)});
        } else sendMessage(message, errorMessage("Something went wrong while trying to ban this member."), false);
    });
}
/**
 * Unbans a user from the discord server
 * @param {Discord.Message} message - Message containing ban instructions and other important data
 * @param {*} auto - Data that signifies if this unban is automatic or not.
 */
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
                    if(!auto){
						sendMessage(message, successMessage(`User **${u.username}** successfully unbanned.`), false, true, "ban");
						scheduleUnban();	
					}
                }).catch((e) => {sendMessage(message, errorMessage("User is not banned."), false); console.log(e)})
            }
    });
}
/**
 * Removes a sticky message from the current channel
 * @param {string} cid - Channel id of the current sticky message
 */
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
/**
 * Updates the database with new sticky message information
 * @param {string} cid 
 * @param {Discord.Message} nm 
 */
function updateSticky(cid, nm){
    connection.query("UPDATE sticky SET mid = ? WHERE cid = ?", [nm.id, cid], (err, results, fields) => {
        if(err) throw err;
    });
}
/**
 * Inserts a new sticky message into the database and posts the sticky message to the current channel.
 * @param {Discord.Message} message - Message containing sticky instructions and other important data
 * @param {string} content - Content of the sticky message
 */
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
/**
 * Retrieves punishment information about a member from the database
 * @param {Discord.GuildMember} member - A member whos data we need to look up
 * @param {string} type - Type of the data we need to look up
 */
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
                    info.addField("[#"+results[i].id+"], issued by **"+member.guild.members.cache.get(results[i].issued_by).displayName+"**", results[i].reason+"\n*"+moment(results[i].date).format("dddd, MMMM Do YYYY, h:mm:ss a")+"*");
                    if(i == results.length - 1){
                        resolve(info);
                    }
                }
            } else resolve(null);
        });
    });
    return promise;
}
/**
 * Checks permissions of a guild member
 * @param {Discord.GuildMember} member - Discord guild member whos permissions should be checked
 * @param {string} lookFor - Type of permission that should be checked
 */
function checkPermissions(member, lookFor){
    let i = 0;
    let promise = new Promise((resolve, reject) => {
        roles.forEach((value, key, map) => {
            i++;
            if(member.roles.cache.has(key)){
                if(value[lookFor] == 1){
                    resolve(value);
                }
            }
            if(roles.size == i){
                reject(null);
            }
        });
    });
    return promise;
}
/**
 * Generates a Discord.RichEmbed success message
 * @param {string} content - Content of the message
 */
function successMessage(content){
    const embed = new Discord.MessageEmbed()
    .setTitle("✅ Success!")
    .setColor(0x28a745)
    .setDescription(content)
    .setTimestamp(new Date());

    return embed;
}
/**
 * Generates a Discord.RichEmbed error message
 * @param {string} content - Content of the message
 */
function errorMessage(content){
    const embed = new Discord.MessageEmbed()
    .setTitle("❌ Error!")
    .setColor(0xdc3545)
    .setDescription(content)
    .setTimestamp(new Date());

    return embed;
}
/**
 * Generates a Discord.RichEmbed warning message
 * @param {string} content - Content of the message
 */
function warnMessage(content){
    const embed = new Discord.MessageEmbed()
    .setTitle("⚠️ Warning!")
    .setColor(0xffc107)
    .setDescription(content)
    .setTimestamp(new Date());

    return embed;
}
/**
 * Generates a Discord.RichEmbed info message
 * @param {string} content - Content of the message
 */
function infoMessage(content){
    const embed = new Discord.MessageEmbed()
    .setTitle("ℹ️ Info message!")
    .setColor(0x17a2b8)
    .setDescription(content)
    .setTimestamp(new Date());
    
    return embed;
}
/**
 * Generates a Discord.RichEmbed welcome message
 * @param {string} content - Content of the message
 */
function wMessage(content){
    const embed = new Discord.MessageEmbed()
    .setTitle("Welcome to PhoenixRP!")
    .setColor(0xff8307)
    .setDescription(content)
    .setTimestamp(new Date())
    .setThumbnail("https://cdn.discordapp.com/app-icons/695719904095240203/52decf1ee25f52b003340ef78f31e511.png?size=256")
    .setFooter("Welcome to PhoenixRP!", "https://cdn.discordapp.com/app-icons/695719904095240203/52decf1ee25f52b003340ef78f31e511.png?size=256");
    
    return embed;
}
/**
 * Generates a Discord.RichEmbed log message
 * @param {Discord.Message} message - Message containing instructions and other important data
 * @param {string} content - Content of the log message
 * @param {string} type - Type of the log message
 */
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
        embed.addField("**Channel**:", message.channel.name, true)
        .addField("**By**:", message.member.displayName, true)
        .setDescription(content.description);
        if(message.mentions != null && message.mentions != undefined && message.mentions.members.first() != undefined && message.mentions.members.first() != null){
            embed.addField("Member involved: ", "**Display name:** "+message.mentions.members.first().displayName+"\n**ID:** "+message.mentions.members.first().id, true);
        }
    } else {
        embed.setDescription(content).addField("By: ", "*Automatic action by PhoenixRP bot.*");
    }

	return embed;
}
/**
 * Generates a Discord.RichEmbed keyword / auto response message
 * @param {string} content - Content of the message
 */
function keywordMessage(content){
	let embed = new Discord.MessageEmbed()
	.setColor(0xff8307)
	.setDescription(content)
	.setFooter("Delivered by PhoenixRP Bot", "https://cdn.discordapp.com/app-icons/695719904095240203/52decf1ee25f52b003340ef78f31e511.png?size=256")
	.setTimestamp(new Date());
	
	return embed;
}
/**
 * Generates a Discord.RichEmbed poll message
 * @param {Discord.Message} message - Message containing instructions and other important data
 * @param {string} content - Content of the message
 */
function pollMessage(message, content){
    let embed = new Discord.MessageEmbed()
    .setFooter(`Poll by: ${message.author.tag}`, "https://cdn.discordapp.com/app-icons/695719904095240203/52decf1ee25f52b003340ef78f31e511.png?size=256")
    .setTimestamp(new Date())
    .setColor(0xff8307)
    .setDescription(content);

    return embed;
}
/**
 * Generates a Discord.RichEmbed deleted message
 * @param {Discord.Message} message - Message that was deleted
 */
function deletedMessage(message){

	if(message != null){
		if(message.author != null){
			uid = `<@${message.author.id}>`;
		} else uid = `${message.author.tag}`

		const embed = new Discord.MessageEmbed()
		.setTitle("🗑️ Message deleted")
		.setColor(0xdc3545)
		.setTimestamp(new Date())
		.addField("**User**:", uid, true)
		.addField("**Channel**:", `<#${message.channel.id}> \`#${message.channel.name}\` `, true)
		.setDescription("**Content**:\n"+message.content+" ")
		.setFooter("MID: "+message.id, "https://cdn.discordapp.com/app-icons/695719904095240203/52decf1ee25f52b003340ef78f31e511.png?size=256");
		

		if(message.attachments != null && message.attachments.first() != null){
			embed.addField("**Attachment**:", message.attachments.first().url);
		}
		return embed;
	}

}
/**
 * Sends a message to a specific user or channel based on parameters
 * @param {Discord.GuildMember | Discord.Message} to - User or message.channel to which this message will be sent
 * @param {string} content - Content of the message to be sent
 * @param {boolean} private - If a message should be a DM or not
 * @param {boolean} log - Indicates if this message is a log message, sent to the specific log channel.
 * @param {string} type - Type of the log message
 * @param {number} ttd - Time to delete. If set it will automatically delete the message once this time had passed. In milliseconds.
 */
function sendMessage(to, content, private, log, type, ttd){ //If we want to send a private message, we pass user, otherwise pass message
    if(private){
        to.send(content).then((m) => {
			if(ttd != null){
				setTimeout(() => {
					m.delete();
				}, ttd);
			}
		}).catch((e) => {console.error("Error while sending private message =>\n"+e)});
    } else {
        to.channel.send(content).then((m) => {
			if(ttd != null){
				setTimeout(() => {
					m.delete();
				}, ttd);
			}
		}).catch((e) => {console.error("Error while sending public message =>\n"+e)});;
    }
    if(log != null && log == true){
        if(defaultChannel != null){
	    defaultChannel.send(logMessage(to, content, type)).catch((e) => {console.error("Error while sending message.")});
	}
    }
}
/**
 * Converts a string to javascript Date()
 * @param {string} string - A string that should be converted into date. Example: 30d2h5m1s
 */
function stringToDateTime(string){
    //day, hour, minute, second

    if(string == null){
        return null;
    }

    let d = string.match(/[0-9]+d/g);
    let h = string.match(/[0-9]+h/g);
    let m = string.match(/[0-9]+m/g);
    let s = string.match(/[0-9]+s/g);

    let date = new Date();
    let checkDate = new Date(date);

    if(d != null && d.length > 0){
        d = d[0];
        d = d.split("d")[0];
        d = parseInt(d);
        date.setHours(date.getHours() + d*24);
    }

    if(h != null && h.length > 0){
        h = h[0];
        h = h.split("h")[0];
        h = parseInt(h);
        date.setHours(date.getHours() + h);
    }

    if(m != null && m.length > 0){
        m = m[0];
        m = m.split("m")[0];
        m = parseInt(m);
        date.setMinutes(date.getMinutes() + m);
    }
        
    if(s != null && s.length > 0){
        s = s[0];
        s = s.split("s")[0];
        s = parseInt(s);
        date.setSeconds(date.getSeconds() + s);
    }
    
    if(checkDate.getTime() === date.getTime())
        return null;
    else return date;

}
/**
 * Grabs data from the database and schedules an unmute for the nearest date.
 */
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
                            if(member != null){ // If they are still in the server
                                member.roles.remove(specialRoles.get("mute"));
                                sendMessage(member, successMessage("You've been unmuted from "+client.guilds.cache.first().name+"."), true);
                                defaultChannel.send(logMessage(null, `User **${member.user.username}** successfully unmuted.`, "mute"));
                                scheduleUnmute();
                                unmute.cancel();
                            } else {
                                scheduleUnmute();
                                unmute.cancel();
                            }
                        } //Else it does not exist, maybe previously deleted.
                    });
                });
        }
    });
    
}
/**
 * Grabs data from the database and schedules an unban for the nearest date.
 */
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
/**
 * In case of a longer bot restart or crash it checks for missed unbans and unmutes and handles them accordingly
 */
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
/**
 * Loads sticky messages from the database, if the message id's do not match it tries to find them in channels.
 * When messages are found it replaces the current messages and posts new ones so it can keep track of each new id.
 */
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
/**
 * Loads roles and their permissions from the database into a local Map
 */
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
/**
 * Loads 'special'(assignment roles such as muted role) roles from the database into a local Map
 */
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
/**
 * Loads keywords which will be used as an auto-response from the database into a local Map
 */
function loadKeywords(){
	keywords.clear();
	connection.query("SELECT keyword, response FROM keywords", [], (err, results, fields) => {
		if(err) throw err;
		
		if(results != null && results.length > 0){
			for(let i = 0; i < results.length; i++){
				keywords.set(results[i].keyword, results[i].response);
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
  loadWelcome();
  loadKeywords();
  
  scheduleUnban();
  scheduleUnmute();

  checkMissed();

  startStatus();

	whitelistChannel = client.guilds.cache.get("642408796580347927").channels.cache.get("714219058777555045");
});
client.on('message', message => {
	
	antiSpam(message);
	
    if(sticky.size > 0 && blockedSticky.get(message.channel.id) === undefined){ //If there are sticky messages && our channel is not blocked
     //We need to check if the message is actually a sticky message sent from the bot, if it is not we proceed
     blockedSticky.set(message.channel.id, new Date()); // Insta block
     let m = sticky.get(message.channel.id);
        if(m != undefined){
            if(message.content.toLowerCase() != env.prefix+"remove sticky"){
                if(message.embeds == null || message.embeds.length == 0 || message.embeds[0].footer == null || message.embeds[0].footer.text != "Sticky message"){
                            m.delete().then(() => {
                                m.channel.send(m.embeds[0]).then((nm) => {
                                    sticky.set(message.channel.id, nm);
                                    updateSticky(message.channel.id, nm);
                                }).catch((e) => {
                                    console.error("Error while replacing sticky message =>\n"+e);
                                    blockedSticky.delete(message.channel.id);
                                });
                                blockedSticky.delete(message.channel.id); // Clear block after a successfull message delete
                            }).catch((e) => { //Clear block since we werent able to delete for some reason
                                blockedSticky.delete(message.channel.id);
                            });

                } else blockedSticky.delete(message.channel.id);
            } else blockedSticky.delete(message.channel.id);
        } else blockedSticky.delete(message.channel.id);
    }

    // Status channel auto remove messages
    if(message != null && message.channel != null && message.channel.id == "642411949908557826"){
		if(message.webhookID != null && message.author.bot){
			if(message.mentions != null && message.mentions.roles != null && message.mentions.roles.first() != null && message.mentions.roles.first().id == "673149980747366431"){
				setTimeout(() => {
					message.channel.messages.fetch({limit:100}).then((msg) => {
						if(msg instanceof Discord.Collection){
							msg.each((m) => {
								if(m.webhookID != null){
									m.delete();
								}
							})
						} else if(m.webhookID != null){
							msg.delete();
						}
					})
				}, 300000);
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
            checkPermissions(message.member, "admin").then((value) => {
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
                checkPermissions(message.member, "sticky").then((value) => {
                    if(value != null && value.sticky == 1){
                        removeSticky(message.channel.id);
                        message.delete();
                    }
                }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"remove sticky`"), false);})
            } else if(instruction[1] == "welcome"){
                checkPermissions(message.member, "admin").then((value) => {
                    if(value != null && value.admin == 1){
                        removeWelcome(message);
                    }
                }).then(() => {sendMessage(message, errorMessage("You do not have enough permissions to remove a welcome message."), false);});
                
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
            checkPermissions(message.member, "warn").then((value) => {
                if(value != null && value.warn == 1){
                        //They have permissions.
                        //Now we can check if they composed the message properly
                        if(instruction [1] == "remove" || instruction[1] == "r" || instruction[1] == "rm"){
                            if(instruction[2] != undefined && instruction[2] != null && !isNaN(instruction[2])){ //If they inserted the warn id and if it is a number
                                removeWarning(message, instruction[2]);
                                message.delete();
                            } else { //They did not enter a valid value as the warn id
                                //Display warn data for user
                                //Let them know to enter the command again.
                                sendMessage(message, errorMessage("You didn't enter a valid value as the warn ID."), false);
                            }
                        } else {
							resolveMember(message, 1).then((member) => {
								if(member != null){
									let warning = message.content.split(instruction[1]);
									if(warning == null  || warning.length == 0 && warning[1] == null || warning[1].length == 0){
										//Let's just send them a message first, just in case something goes wrong with inserting into db. They don't need to know we have db problems :D
										warning = "none";
									} else warning = warning[1].trim();
										warn(message, warning, member);
										message.delete();
									} else sendMessage(message, errorMessage("Could not find that member."), false);
							}).catch(e => console.error(e));
						}
                    }
            }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"warn`"), false);});
        } else if(instruction[0] == "mute"){
            //mute @user -time reason
            if(specialRoles.has("mute")){
                checkPermissions(message.member, "mute").then((value) => {
                    if(value != null && value.mute == 1){
                            //They have permissions.
                            //Now we can check if they composed the message properly
							
							resolveMember(message, 1).then((member) => {
								if(member != null){
									connection.query("SELECT * FROM mutes WHERE uid = ? AND active = 1", [member.id], (err, results, fields) => {
										if(err) throw err;

										if(results.length > 0){
											sendMessage(message, errorMessage("This user is already muted!"), false);
										} else {
												let string = null;
												let until;

												if(instruction.length > 2){
													until = stringToDateTime(instruction[2]);
												} else {
													until = null;
													string = "none";
												}

												if(string == null){
													if(until == null){
														string = message.content.split(instruction[1])[1].trim();
													} else {
														if(instruction[3] != null){
															string = message.content.split(instruction[2])[1].trim();
														} else string = "none";
														
													}
												}

												mute(message, until, string, null, member);                                            
										}
									});
								} else sendMessage(message, errorMessage("Could not find this member."), false);
							})
                            if(message.mentions != null && message.mentions != undefined && message.mentions.members != null && message.mentions.members != undefined){

                            } else sendMessage(message, errorMessage("You need to mention a member in order to mute them!"), false);
                        }
                }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"mute`"), false);});
            } else sendMessage(message, errorMessage("The bot isn't properly configured. You need to add a mute role first!"), false);
        } else if(instruction[0] == "unmute"){
            checkPermissions(message.member, "mute").then((value) => {
                if(value != null && value.mute == 1){ //If they have the role, and permissions to mute
                    if(message.mentions != null && message.mentions != undefined && message.mentions.members != null && message.mentions.members != undefined){
                        unmute(message);
                        message.delete();
                    } else sendMessage(message, errorMessage("You need to mention a member in order to mute them!"), false);
                }
            }).catch(()=>{sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"mute`"), false);});
        } else if(instruction[0] == "kick" || instruction[0] == "k"){
            checkPermissions(message.member, "kick").then((value) => {
                if(value != null && value.kick == 1){ //If they have the role, and permissions to kick
					resolveMember(message, 1).then((member) => {
						if(member != null){
							if(message.member.roles.highest.comparePositionTo(member.roles.highest) > 0){
								let reason = message.content.split(instruction[1])[1];
								if(reason == null || reason.length == 0){
									reason = "none";
								} 
								reason = reason.trim();
								kick(message, reason, member);
								message.delete();
							} else sendMessage(message, errorMessage("Cannot kick. This member has higher priviledges than you."), false);	
						}
					});
                }
            }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"kick`"), false);});
        } else if(instruction[0] == "ban" || instruction[0] == "b"){
            checkPermissions(message.member, "ban").then((value) => {
                if(value != null && value.ban == 1){ //If they have the role, and permissions to mute
				let until = null;
                                let string = null;
                                let del;
								let ep;
                                if(instruction[1][0] == "d"){
                                    del = 7;
									ep = 2;
                                    if(instruction.length > 3){
                                        until = stringToDateTime(instruction[2]);
                                    } else {
                                        until = null;
                                        string = "none";
                                    }

                                    if(string == null){
                                        if(until == null){
                                            string = message.content.split(instruction[1])[1].trim();
                                        } else {
                                            string = message.content.split(instruction[2])[1].trim();
                                        }
                                    }
                                } else {
                                    del = null;
									ep = 1;
                                    if(instruction.length > 2){
                                        until = stringToDateTime(instruction[2]);
                                    } else {
                                        until = null;
                                        string = "none";
                                    }

                                    if(string == null){
                                        if(until == null){
                                            string = message.content.split(instruction[1])[1].trim();
                                        } else {
                                            string = message.content.split(instruction[2])[1].trim();
                                        }
                                    }
                                }
					resolveMember(message, ep).then((member) => {
						if(member != null){
							if(message.member.roles.highest.comparePositionTo(message.mentions.members.first().roles.highest) > 0){
                                    if(message.mentions.members.first().bannable){
                                        ban(message, until, string, del, null, member);
                                        message.delete();
                                    } else sendMessage(message, errorMessage("This member is not bannable."), false);
                            } else sendMessage(message, errorMessage("Cannot ban. You need more priviledges to ban this user."), false);
						} else {
							if(del == 7){
								if(!isNaN(instruction[2])){
									ban(message, until, string, del, instruction[2], null);
									message.delete();
								} else sendMessage(message, errorMessage("User left, please use only user id to ban."), false);
							} else {
								if(!isNaN(instruction[1])){
									ban(message, until, string, del, instruction[1], null);
									message.delete();
								} else sendMessage(message, errorMessage("User left, please use only user id to ban."), false);
							}
						}
						
					});
                }
            }).catch((e) => {sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"ban`"), false); console.log(e)});
        } else if(instruction[0] == "unban"){
            checkPermissions(message.member, "ban").then((value) => {
                if(value != null && value.ban == 1){
                    if(instruction[1] != null && instruction[1] != undefined && instruction[1].length > 0){
                        unban(message);
                        message.delete();
                    }
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
                                message.delete();
                            }
                        });
                    } else sendMessage(message, errorMessage("You need to mention a role in order to add it."), false);
                }
            }
        } else if(instruction[0] == "unicorn"){
            message.reply("🦄");
        } else if(instruction[0] == "info"){
                checkPermissions(message.member, "mute").then((value) => {
                    if(value != null){
                        resolveMember(message, 1).then((member) => {
							if(member != null){
								displayInfo(member, "warn").then((response) => {
									if(response != null){
										sendMessage(message, response.setTitle("Warnings: "), false);
									} else sendMessage(message, infoMessage("This user has no items on their warn record."), false);
								}).catch((e) => {console.error("Error while trying to display info =>\n"+e)});
								displayInfo(member, "mute").then((response) => {
									if(response != null){
										sendMessage(message, response.setTitle("Mutes: "), false);
									} else sendMessage(messag, infoMessage("This user has no items on their mute record."), false);
								}).catch((e) => {console.error("Error while trying to display info =>\n"+e)})
								displayInfo(member, "kick").then((response) => {
									if(response != null){
										sendMessage(message, response.setTitle("Kicks: "), false);
									} else sendMessage(message, infoMessage("This user has no items on their kick record."), false);
								}).catch((e) => {console.error("Error while trying to display info =>\n"+e)})
								displayInfo(member, "ban").then((response) => {
									if(response != null){
										sendMessage(message, response.setTitle("Bans: "), false);
									} else sendMessage(message, infoMessage("This user has no items on their ban record."), false);
								}).catch((e) => {console.error("Error while trying to display info =>\n"+e)})
							}
						})
                    }
                }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"info`"), false);});
        } else if(instruction[0] == "sticky"){
                let content = message.content.split(env.prefix+""+instruction[0])[1];
                if(content != null && content != undefined && content.length > 0){
                    checkPermissions(message.member, "sticky").then((value) => {
                        if(value != null && value.sticky == 1){
                            addSticky(message, content);
                        }
                    }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use `"+env.prefix+"sticky`"), false);})
                } else sendMessage(message, errorMessage("You cannot set an empty sticky message!"),false);
        } else if(instruction[0] == "set" && instruction[1] == "default" && instruction[2] == "channel" && instruction[3] != null){
            checkPermissions(message.member, "admin").then((value) => {
                if((value != null && value.admin == 1) || message.author.id == message.guild.ownerID){

                    let type = null;
                    if(instruction[3] == "log"){
                        type = "log";
                    } else if(instruction[3] == "mlog"){
                        type = "mlog";
                    } else {
                        sendMessage(message, errorMessage("Invalid instruction parameter."), false);
                        return;
                    }

                    connection.query("INSERT INTO default_channel VALUES(null, ?, ?, default, ?) ON DUPLICATE KEY UPDATE rid = ?", [message.channel.id, type, message.author.id, message.channel.id], (err, results, fields) => {
                        if(err) console.error("Error while inserting default channel\n"+err)
                        if(results.affectedRows > 0){
                            sendMessage(message, successMessage("Successfully added a default channel."), false);
                            if(type == "log")
                                defaultChannel = message.channel;
                            else if(type == "mlog")
                                messageLogChannel = message.channel;
                        } else sendMessage(message, errorMessage("Unable to add a default channel."), false);
                    });
                } 
            }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to do this."), false);})
	    } else if(instruction[0] == "start"){
            checkPermissions(message.member, "admin").then((value) => {
                if(value != null && value.admin == 1){
                    startStatus();
                }
            }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to do this."), false)})
        } else if(instruction[0] == "welcome"){
            if(instruction[1] != null && instruction[1] != undefined && instruction[1].length > 0){ // Welcome message exists
                checkPermissions(message.member, "admin").then((value) => {
                    if(value != null && value.admin == 1){
                        //We can add the welcome message
                        setWelcome(message);
                    }
                });
            }
        } else if(instruction[0] == "whois"){
			resolveMember(message, 1).then((member) => {
				if(member != null){
					sendMessage(message, whois(member), false);
				} else sendMessage(message, errorMessage("Could not find this member."), false);
			})
        } else if(instruction[0] == "prune"){
            checkPermissions(message.member, "warn").then((value) => {
                if(value != null){
					if(message.mentions != null && message.mentions.members != null && message.mentions.members.first()!=null){
						//We want to delete messages from a member
						if(!isNaN(instruction[2]) && parseInt(instruction[2]) > 0 && parseInt(instruction[2]) <= 100){
							let amount = parseInt(instruction[2]);
							let count = 1;
							message.channel.messages.cache.some((m) => {
								if(count <= amount){
									if(m.author.id == message.mentions.members.first().id){
										m.delete();
										count++;
									}
								} else return;
							});
						} else sendMessage(message, errorMessage("You need to input the number of messages you want to delete. `0 to 100`"), false);
					} else {
						// We want to delete x messages
						if(!isNaN(instruction[1]) && parseInt(instruction[1]) > 0 && parseInt(instruction[1]) <= 100){
							message.channel.bulkDelete(parseInt(instruction[1]));
						} else sendMessage(message, errorMessage("You need to input the number of messages you want to delete. `0 to 100`"), false);
					}
                } else sendMessage(message, errorMessage("You do not have enough permissions to use this command."), false);
            }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use this command."), false)});
        } else if(instruction[0] == "poll"){
            checkPermissions(message.member, "admin").then((value) => {
                if(value != null && value.admin == 1){
                    message.channel.send(pollMessage(message, message.content.split("poll ")[1])).then((m) => {
                        message.delete();
						let type = message.content.split("poll ")[1];
						
						let typematch = type.match(new RegExp(/[0-9].*/, "g"));
						if(typematch != null && typematch.length > 1){
							for(let i = 0; i < typematch.length; i++){
								m.react(charToEmoji(i+1));
							}
						} else {
							m.react("👍").then(() => {
								m.react("🤷").then(() => {
									m.react("👎");
								})
							})
						}

                    });
                }
            }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use this command."), false)});
        } else if(instruction[0] == "keyword"){
			checkPermissions(message.member, "admin").then((value) => {
				if(value != null && value.admin == 1){
					if(instruction[1] == "set"){
						 if(instruction[2] != null && instruction[3] != null){
							 
							 let keyword = instruction[2];
							 let response = message.content.split(keyword+" ")[1].trim();
							 
							 connection.query("INSERT INTO keywords VALUES (null, ?, ?, default, ?) ON DUPLICATE KEY UPDATE response = ?, set_by = ?, date = default", [keyword, response, message.member.id, response, message.member.id], (err, results, fields) => {
								if(err) throw err;
								
								if(results != null && results.affectedRows > 0){
									sendMessage(message, successMessage(`Successfully set new keyword: \`${keyword}\``), false);
									loadKeywords();
								} else sendMessage(message, errorMessage("Something went wrong while setting new keyword."), false);
							});
						 }
					} else if(instruction[1] == "remove"){
						if(instruction[2] != null){
							connection.query("DELETE FROM keywords WHERE keyword = ?", [instruction[2]], (err, results, fields) => {
								if(err) throw err;
								
								if(results != null && results.affectedRows > 0){
									sendMessage(message, successMessage("Successfully removed keyword `"+instruction[2]+"`."));
									loadKeywords();
								} else sendMessage(message, errorMessage("Something went wrong while removing keyword. Please try again?"), false);
							})
						}
					} else if(instruction[1] == "list"){
						connection.query("SELECT keyword, response FROM keywords", [], (err, results, fields) => {
							if(err) throw err;
							
							if(results != null && results.length > 0){
								let embed = new Discord.MessageEmbed()
								.setDescription("List of current keywords: ")
								.setColor(0xff8307)
								.setFooter("Delivered by PhoenixRP Bot", "https://cdn.discordapp.com/app-icons/695719904095240203/52decf1ee25f52b003340ef78f31e511.png?size=256")
								.setTimestamp(new Date());
								
								for(let i = 0; i < results.length; i++){
									let nr;
									if(results[i].response.length > 32){
										nr = results[i].response.substr(0, 32)+"...";
									} else nr = results[i].response;
									
									embed.addField(`${i}. ${results[i].keyword}`, `${nr}`);
									
									if(i == results.length - 1){
										sendMessage(message, embed, false);
									}
								}
							} else sendMessage(message, infoMessage("No keywords set."), false);
						})
					}
				}
			}).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use this command."), false)})

		} else if(instruction[0] == "status"){
			checkPermissions(message.member, "admin").then(() => {
				pm2.describe("main", (err, results) => {
					let embed = new Discord.MessageEmbed()
					.setThumbnail("https://cdn0.iconfinder.com/data/icons/streamline-emoji-1/48/093-robot-face-2-512.png")
					.setFooter("PhoenixRP Bot", "https://cdn.discordapp.com/app-icons/695719904095240203/52decf1ee25f52b003340ef78f31e511.png?size=256")
					.setColor(0xff8307)
                    .setTimestamp(new Date())
                    .addField("**STATUS:**", "Online")
					.addField("**CPU USAGE:**", results[0].monit.cpu+"%")
					.addField("**MEMORY USAGE**:", (results[0].monit.memory/1000000).toFixed(2)+"MB")
					.addField("**UPTIME**:", moment().diff(new Date(results[0].pm2_env.pm_uptime), "hours", true).toFixed(2)+"hours");
					
					sendMessage(message, embed, false);
				});
			}).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use this command!"), false)});
		} else if(instruction[0] == "slowmode"){
			checkPermissions(message.member, "mute").then(() => {		
				if(!isNaN(instruction[1])){
					let time = parseInt(instruction[1]);
					message.channel.setRateLimitPerUser(time).catch((e) => {console.error(e)});
				} else message.channel.setRateLimitPerUser(0).catch((e) => {console.error(e)});
			}).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use this command!"), false)})
		}else if(instruction[0] == "note"){
            if(instruction[1] == "create" || instruction[1] == "add"){
                checkPermissions(message.member, "mute").then(() => {
                    resolveMember(message, 2).then((member) => {
                        if(member != null){
                            createNote(message, message.content.split(instruction[2]+" ")[1], member);
                        } else sendMessage(message, errorMessage("Could not find this member."), false);
                    }).catch((e) => console.error(e));
                }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use this command!"), false)})
            } else if(instruction[1] == "remove" || instruction[1] == "delete"){
                checkPermissions(message.member, "admin").then(() => {
                    if(!isNaN(instruction[2])){
                        removeNote(message, instruction[2]);
                    } else sendMessage(message, errorMessage("Your ID is not a valid number."), false);
                }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use this command!"), false)})
            } else if(instruction[1] == "view"){
                checkPermissions(message.member, "mute").then(() => {
                    resolveMember(message, 2).then((member) => {
                        if(member != null){
                            viewNotes(message, member);
                        } else sendMessage(message, errorMessage("Could not find this member."), false);
                    });
                }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use this command!"), false)})
            }
        } else if(instruction[0] == "request"){
			if(instruction[1] != null && instruction[1].length > 0){
				let attachments = "";
				if(message.attachments != null && message.attachments.size > 0){
					message.attachments.each((a) => {
						attachments += a.url;
					})
				}
                createDonorRequest(message, JSON.stringify({content: message.content.split(instruction[0]+" ")[1]+"\n"+attachments}), message.member);
            }
        } else if(instruction[0] == "approve"){
                checkPermissions(message.member, "admin").then((value) => {
                    if(value != null){
                        if(!isNaN(instruction[1])){
							if(instruction[2] != null && instruction[2].length > 0){
								approveDonorRequest(message, parseInt(instruction[1]), message.content.split(instruction[1]+" ")[1]);
							} else approveDonorRequest(message, parseInt(instruction[1]));
                            
                        } else sendMessage(message, errorMessage("You need to input a valid number as the id."), false);
                    } else sendMessage(message, errorMessage("You do not have enough permissions to use this command."), false);
                }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use this command."), false);})
            } if(instruction[0] == "deny"){
                checkPermissions(message.member, "admin").then((value) => {
                    if(value != null){
                        if(!isNaN(instruction[1])){
                            if(instruction[2] != null && instruction[2].length > 0){
                                denyDonorRequest(message, parseInt(instruction[1]), message.content.split(instruction[1]+" ")[1]);
                            } else denyDonorRequest(message, instruction[1], "No reason given.");
                        } else sendMessage(message, errorMessage("You need to input a valid number as the id."), false);
                    } else sendMessage(message, errorMessage("You do not have enough permissions to use this command."), false);
                }).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use this command."), false);})
            } else if(instruction[0] == "addsteam"){
			checkPermissions(message.member, "mute").then((value) => {
				if(value != null){
					resolveMember(message, 2).then((member) => {
						if(member != null){
                            addSteam(message, member, instruction[1]);
                        } else sendMessage(message, errorMessage("Could not find this member."), false);
					})
				} else sendMessage(message, errorMessage("You do not have enough permissions to use this command."), false);
			}).catch(() => {sendMessage(message, errorMessage("You do not have enough permissions to use this command."), false);});
		} else if(instruction[0] == "steam"){
			if(instruction[1] == "remove"){
				checkPermissions(message.member, "admin").then((value) => {
					if(value != null){
						resolveMember(message, 1).then((member) => {
							if(member != null){
								removeSteam(message, member);
							} if(member == null){
								removeSteam(message, instruction[2]);
							}
						})
					} else sendMessage(message, errorMessage("You do not have enough permissions to use this command."), false);
				}).catch(() =>{sendMessage(message, errorMessage("You do not have enough permissions to use this command."), false);})
			} else {
				checkPermissions(message.member, "mute").then((value) => {
					if(value != null){
						resolveMember(message, 1).then((member) => {
							if(member != null){
								viewSteam(message, member);
							} if(member == null){
								viewSteam(message, instruction[1]);
							}
						})
					} else sendMessage(message, errorMessage("You do not have enough permissions to use this command."), false);
				}).catch(() =>{sendMessage(message, errorMessage("You do not have enough permissions to use this command."), false);})
			}
			
		} else if(instruction[0] == "whitelist"){
			checkPermissions(message.member, "mute").then((value) => {
				if(value != null){
					resolveMember(message, 2).then((member) => {
						if(member != null){
							whitelist(message, member, instruction[1]);
						} else sendMessage(message, errorMessage("Cannot find member."), false);
					})
				}
			})
		} else if(instruction[0] == "denywhitelist"){
			checkPermissions(message.member, "mute").then((value) => {
				if(value != null){
					resolveMember(message, 2).then((member) => {
						if(member != null){
							denyWhitelist(message, member, instruction[1]);
						} else sendMessage(message, errorMessage("Cannot find member."), false);
					})
				}
			})
		}
    } else if(keywords.has(message.content)){
		sendMessage(message, keywordMessage(keywords.get(message.content)), false);
	}

});
client.on("guildBanRemove", (guild, user) => {
    //Someone manually unbanned a user, we still want to log this
    connection.query("UPDATE bans SET active = 0 WHERE active = 1 AND uid = ?", [user.id], (err, results, fields) => {
        if (err) console.log("Error while logging manual unbans. =>\n"+err);
    })
});

client.on("guildMemberAdd", (member) => {
    if(welcomeMessage != null){
        member.send(wMessage(welcomeMessage));
    }
	
	checkMuteStatus(member);
});

client.on("messageDelete", (message) => {
    if(!message.author.bot){
        if(messageLogChannel != null){
            messageLogChannel.send(deletedMessage(message));
        }
    };
});

client.on("messageDeleteBulk", (messages) => {
const embed = new Discord.MessageEmbed()
    .setTitle("🗑️ Bulk delete")
    .setColor(0xdc3545)
    .setTimestamp(new Date())
    .setFooter("Managed by PhoenixRP Bot", "https://cdn.discordapp.com/app-icons/695719904095240203/52decf1ee25f52b003340ef78f31e511.png?size=256")
    .addField("**Amount**:", messages.size, true)
    .addField("**Channel**:", "<#"+messages.first().channel.id+"> `#"+messages.first().channel.name+"`", true);

    if(messageLogChannel != null){
        messageLogChannel.send(embed);
    }
});

client.login(env.token);

