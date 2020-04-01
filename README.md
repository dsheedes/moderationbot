# Documentation for moderation bot
Default prefix is `?`, however it can be changed in the env file.

## Setup
`?add -< permissions > @Role(s)` - You can add roles that will be able to access the functionality of this bot. You can tag multiple roles at once. Only the server owner can initially setup these roles.
### Permission list
- `k` - Kick permission
- `b` - Ban/unban permission
- `w` - Warn/remove warn permission
- `m` - Mute/unmute permission
- `s` - Add/remove sticky permission
- `a` - Administrator permission. This role is able to assign and remove these permissions.

> *Example:* `?add -wm @Role` *- Add warn and mute permissions to role.*

`?remove @Role` - Remove roles that can use the bot. Server owner and admin perms can do this.

`?role add muted @Role` - Adds a role that will be used as `Muted` role

`?set default channel` - Sets a default log channel to the channel to which this message was sent.

## Functions
`?warn @Member < reason >` - Send a warning message. *2048 characters limit.*

`?warn remove #ID` - Remove warning based on warning id

`?info @Member` - List all logs about this member. Here you can see the warning id too.

`?mute @Member -< time > < Reason >` - Mute a member for a certain time amount. Can be forever.
### Time parameter
- `d` - Days
- `h` - Hours
- `m` - Minutes
- `s` - Seconds

>*Example:* `?mute @Member -7d1h30m16s Reason for muting` - *Mutes a member for 7 days, 1 hour, 30 minutes and 16 seconds*

`?unmute @Member` - Unmutes a member

`?kick @Member < Reason >` - Kicks a member from the guild

`?ban @Member -< time > < Reason > ` - Bans a member. Time parameter is same as mute.

`?sticky < Message >` - Creates a sticky message in the channel which this message is posted in.

`?remove sticky` - Removes a sticky message from the channel which this message is posted in.

`?start` - Starts the status bot
