const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const prefix = "/";
const OWNER_ID = process.env.OWNER_ID; // Met ton ID dans les variables d'environnement
const infractions = {}; // Stockage warns / bans
const balances = {};   // Stockage balance pour /balance /daily

client.on("ready", () => {
    console.log(`Bot connecté en tant que ${client.user.tag}`);
    client.user.setActivity("MODERATION & FUN");
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    // =============================
    // MODERATION
    // =============================

    if (command === "ban") {
        if (!message.member.permissions.has("BanMembers") && message.author.id !== OWNER_ID)
            return message.reply("❌ Tu n'as pas la permission de bannir !");
        const user = message.mentions.members.first();
        if (!user) return message.reply("❌ Mentionne un utilisateur à bannir.");
        if (user.roles.highest.position >= message.member.roles.highest.position)
            return message.reply("❌ Tu ne peux pas bannir un membre avec un rôle égal ou supérieur au tien !");
        await user.ban({ reason: args.join(" ") || "Aucune raison fournie" });
        message.channel.send(`✅ ${user.user.tag} a été banni !`);
        if (!infractions[user.id]) infractions[user.id] = { warns: 0, bans: 0 };
        infractions[user.id].bans += 1;
    }

    if (command === "unban") {
        if (!message.member.permissions.has("BanMembers") && message.author.id !== OWNER_ID)
            return message.reply("❌ Tu n'as pas la permission de débannir !");
        const userId = args[0];
        if (!userId) return message.reply("❌ Indique l'ID de l'utilisateur à débannir !");
        try {
            await message.guild.members.unban(userId);
            message.channel.send(`✅ L'utilisateur ${userId} a été débanni !`);
        } catch {
            message.reply("❌ Impossible de débannir cet utilisateur.");
        }
    }

    if (command === "kick") {
        if (!message.member.permissions.has("KickMembers") && message.author.id !== OWNER_ID)
            return message.reply("❌ Tu n'as pas la permission de kick !");
        const user = message.mentions.members.first();
        if (!user) return message.reply("❌ Mentionne un utilisateur à expulser.");
        if (user.roles.highest.position >= message.member.roles.highest.position)
            return message.reply("❌ Tu ne peux pas kick un membre avec un rôle égal ou supérieur au tien !");
        await user.kick(args.join(" ") || "Aucune raison fournie");
        message.channel.send(`✅ ${user.user.tag} a été expulsé !`);
    }

    if (command === "mute") {
        if (!message.member.permissions.has("ModerateMembers") && message.author.id !== OWNER_ID)
            return message.reply("❌ Tu n'as pas la permission de mute !");
        const user = message.mentions.members.first();
        if (!user) return message.reply("❌ Mentionne un utilisateur à mute.");
        const durationArg = args.find(arg => !arg.startsWith("<@") && !isNaN(arg));
        const duration = durationArg ? parseInt(durationArg) * 60000 : 60000; // 1 min par défaut
        await user.timeout(duration, args.join(" ") || "Mute temporaire");
        message.channel.send(`🔇 ${user.user.tag} a été mute !`);
    }

    if (command === "unmute") {
        if (!message.member.permissions.has("ModerateMembers") && message.author.id !== OWNER_ID)
            return message.reply("❌ Tu n'as pas la permission de unmute !");
        const user = message.mentions.members.first();
        if (!user) return message.reply("❌ Mentionne un utilisateur à unmute.");
        await user.timeout(null);
        message.channel.send(`🔊 ${user.user.tag} a été unmute !`);
    }

    if (command === "clear") {
        if (!message.member.permissions.has("ManageMessages") && message.author.id !== OWNER_ID)
            return message.reply("❌ Tu n'as pas la permission de supprimer des messages !");
        const channel = message.mentions.channels.first() || message.channel;
        const amount = parseInt(args.find(arg => !arg.startsWith("<#"))) || 10;
        await channel.bulkDelete(amount, true).catch(() => message.reply("❌ Impossible de supprimer ces messages."));
        message.channel.send(`✅ ${amount} messages supprimés dans ${channel.name}`);
    }

    if (command === "warn") {
        if (!message.member.permissions.has("Administrator") && message.author.id !== OWNER_ID)
            return message.reply("❌ Seul un administrateur ou le propriétaire peut avertir !");
        const user = message.mentions.members.first();
        if (!user) return message.reply("❌ Mentionne un utilisateur à avertir.");
        if (!infractions[user.id]) infractions[user.id] = { warns: 0, bans: 0 };
        infractions[user.id].warns += 1;
        message.channel.send(`⚠️ ${user.user.tag} a reçu un avertissement ! Total : ${infractions[user.id].warns}`);
    }

    if (command === "infractions") {
        const user = message.mentions.members.first() || message.member;
        const data = infractions[user.id] || { warns: 0, bans: 0 };
        message.channel.send(`📄 ${user.user.tag} a ${data.warns} avertissement(s) et ${data.bans} ban(s).`);
    }

    // =============================
    // UTILISATEUR / INFOS
    // =============================

    if (command === "userinfo") {
        const user = message.mentions.members.first() || message.member;
        const embed = new EmbedBuilder()
            .setTitle(`Infos de ${user.user.tag}`)
            .setThumbnail(user.user.displayAvatarURL())
            .addFields(
                { name: "Pseudo", value: user.user.username, inline: true },
                { name: "Tag", value: user.user.tag, inline: true },
                { name: "ID", value: user.id, inline: true },
                { name: "Rejoint", value: `<t:${Math.floor(user.joinedTimestamp/1000)}:R>`, inline: true },
                { name: "Roles", value: user.roles.cache.map(r => r.name).join(", "), inline: false }
            );
        message.channel.send({ embeds: [embed] });
    }

    if (command === "serverinfo") {
        const guild = message.guild;
        const embed = new EmbedBuilder()
            .setTitle(`Infos du serveur ${guild.name}`)
            .setThumbnail(guild.iconURL())
            .addFields(
                { name: "ID", value: guild.id, inline: true },
                { name: "Membres", value: `${guild.memberCount}`, inline: true },
                { name: "Boosts", value: `${guild.premiumSubscriptionCount}`, inline: true },
                { name: "Créé le", value: `<t:${Math.floor(guild.createdTimestamp/1000)}:R>`, inline: true }
            );
        message.channel.send({ embeds: [embed] });
    }

    if (command === "avatar") {
        const user = message.mentions.users.first() || message.author;
        message.channel.send(`${user.tag} → ${user.displayAvatarURL({ dynamic: true, size: 1024 })}`);
    }

    if (command === "say") {
        if (!message.member.permissions.has("Administrator") && message.author.id !== OWNER_ID)
            return message.reply("❌ Seul un admin ou le propriétaire peut utiliser cette commande !");
        const msg = args.join(" ").replace(/{user_name}/g, message.author.username);
        message.channel.send(msg);
    }

    // =============================
    // FUN / UTILITAIRES
    // =============================

    if (command === "roll") {
        const range = args[0] ? args[0].split("-").map(Number) : [1, 100];
        const result = Math.floor(Math.random() * (range[1]-range[0]+1)) + range[0];
        message.channel.send(`🎲 Résultat : ${result}`);
    }

    if (command === "coinflip") {
        const result = Math.random() < 0.5 ? "Pile" : "Face";
        message.channel.send(`🪙 Résultat : ${result}`);
    }

    if (command === "serverboosters") {
        const boosters = message.guild.members.cache.filter(m => m.premiumSince).map(m => m.user.tag);
        message.channel.send(`🚀 Boosters du serveur (${boosters.length}) :\n${boosters.join("\n")}`);
    }

    if (command === "randommember") {
        const members = message.guild.members.cache.filter(m => !m.user.bot);
        const random = members.random();
        message.channel.send(`🎲 Membre aléatoire : ${random.user.tag}`);
    }

    if (command === "balance") {
        const user = message.mentions.users.first() || message.author;
        if (!balances[user.id]) balances[user.id] = 0;
        message.channel.send(`💰 ${user.tag} a ${balances[user.id]} coins.`);
    }

    if (command === "daily") {
        const user = message.author;
        if (!balances[user.id]) balances[user.id] = 0;
        balances[user.id] += 100; // Récompense quotidienne
        message.channel.send(`💵 ${user.tag} a reçu 100 coins ! Nouveau solde : ${balances[user.id]}`);
    }
});

client.login(process.env.TOKEN); // Token à mettre dans les variables d'environnement
