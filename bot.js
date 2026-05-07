const TelegramBot = require('node-telegram-bot-api');
const bedrock = require('bedrock-protocol');
const path = require('path');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is required!');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

let mcBot = null;
let disconnectTimer = null;
let botStartTime = null;

const mainKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: '🔌 اتصال', callback_data: 'connect' },
        { text: '❌ قطع الاتصال', callback_data: 'disconnect' }
      ],
      [
        { text: '📊 حالة البوت', callback_data: 'status' },
        { text: '📚 المساعدة', callback_data: 'help' }
      ],
      [
        { text: '⏱️ ساعة', callback_data: 'duration_60' },
        { text: '⏱️ 10 ساعات', callback_data: 'duration_600' },
        { text: '⏱️ مخصص', callback_data: 'duration_custom' }
      ]
    ]
  }
};

const backKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '🔙 رجوع', callback_data: 'back' }]
    ]
  }
};

function createBedrockBot(host, port, version, durationMinutes, chatId) {
  if (mcBot) {
    try { mcBot.close(); } catch(e) {}
    if (disconnectTimer) clearTimeout(disconnectTimer);
  }

  const options = {
    host: host,
    port: parseInt(port) || 19132,
    username: 'Bot_' + Math.random().toString(36).substring(7),
    version: version || '1.26.13.1',
    offline: true
  };

  try {
    mcBot = bedrock.createClient(options);
    botStartTime = Date.now();

    mcBot.on('login', () => {
      bot.sendMessage(chatId, `✅ تم الدخول لسيرفر البيدروك بنجاح!\nالإصدار: ${options.version}\nالوقت: ${new Date().toLocaleString('ar-EG')}`);
      
      if (durationMinutes && durationMinutes > 0) {
        const durationMs = durationMinutes * 60 * 1000;
        disconnectTimer = setTimeout(() => {
          if (mcBot) {
            try { mcBot.close(); } catch(e) {}
            bot.sendMessage(chatId, '⏰ انتهى الوقت المحدد وتم قطع الاتصال تلقائياً');
            mcBot = null;
          }
        }, durationMs);
        
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        let durationText = '';
        if (hours > 0) durationText += `${hours} ساعة `;
        if (minutes > 0) durationText += `${minutes} دقيقة`;
        bot.sendMessage(chatId, `⏳ سيبقى البوت متصلاً لمدة: ${durationText}`);
      }
    });

    mcBot.on('close', (reason) => {
      bot.sendMessage(chatId, `❌ تم قطع الاتصال: ${reason || 'لا يوجد سبب'}`);
      mcBot = null;
      if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
      }
    });

    mcBot.on('error', (err) => {
      bot.sendMessage(chatId, `⚠️ خطأ: ${err.message}`);
      console.error(err);
    });

    mcBot.on('text', (packet) => {
      if (packet.message) {
        bot.sendMessage(chatId, `💬 ${packet.source_name || 'لاعب'}: ${packet.message}`);
      }
    });

    return mcBot;
  } catch (err) {
    bot.sendMessage(chatId, `⚠️ فشل الاتصال: ${err.message}`);
    console.error(err);
    return null;
  }
}

bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;

  bot.answerCallbackQuery(callbackQuery.id);

  if (data === 'connect') {
    bot.sendMessage(chatId, '🔌 أرسل بيانات الاتصال:\n/connect <ip> <port> [version] [duration]\nمثال: /connect play.example.com 19132 1.26.13.1 60\nالمنفذ الافتراضي للبيدروك: 19132', mainKeyboard);
  } else if (data === 'disconnect') {
    if (mcBot) {
      try { mcBot.close(); } catch(e) {}
      bot.sendMessage(chatId, '✅ تم قطع الاتصال', mainKeyboard);
    } else {
      bot.sendMessage(chatId, '❌ لا يوجد اتصال حالياً', mainKeyboard);
    }
  } else if (data === 'status') {
    if (mcBot) {
      const uptime = botStartTime ? Math.floor((Date.now() - botStartTime) / 60000) : 0;
      bot.sendMessage(chatId, `✅ البوت متصل\n⏱️ مدة الاتصال: ${uptime} دقيقة\n📍 السيرفر: ${mcBot.options?.host || 'غير معروف'}:${mcBot.options?.port || 'غير معروف'}`, mainKeyboard);
    } else {
      bot.sendMessage(chatId, '❌ البوت غير متصل حالياً', mainKeyboard);
    }
  } else if (data === 'help') {
    bot.sendMessage(chatId, `
📚 الأوامر المتاحة للبيدروك:
/start - بدء التشغيل
/connect <ip> <port> [version] [duration] - الاتصال بالسيرفر
/disconnect - قطع الاتصال
/status - حالة البوت
/help - هذه الرسالة

أمثلة:
/connect pe.mcserver.com 19132 1.26.13.1 60
/connect 192.168.1.100 19132 120

ملاحظات:
- المنفذ الافتراضي للبيدروك: 19132
- الإصدار الافتراضي: 1.26.13.1
- المدة بالدقائق (60=ساعة، 600=10 ساعات)
    `, backKeyboard);
  } else if (data === 'duration_60') {
    bot.sendMessage(chatId, '⏱️ تم اختيار ساعة واحدة\nاستخدم الأمر:\n/connect <ip> 19132 1.26.13.1 60', mainKeyboard);
  } else if (data === 'duration_600') {
    bot.sendMessage(chatId, '⏱️ تم اختيار 10 ساعات\nاستخدم الأمر:\n/connect <ip> 19132 1.26.13.1 600', mainKeyboard);
  } else if (data === 'duration_custom') {
    bot.sendMessage(chatId, '⏱️ أرسل المدة بالدقائق:\nمثال: 120 (ساعتين)\nثم استخدم الأمر /connect مع المدة', mainKeyboard);
  } else if (data === 'back') {
    bot.sendMessage(chatId, '🏠 القائمة الرئيسية', mainKeyboard);
  }
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcome = `
👋 مرحباً بك في بوت ماين كرافت البيدروك!
استخدم الأزرار أدناه أو الأوامر للتحكم
  `;
  bot.sendMessage(chatId, welcome, mainKeyboard);
});

bot.onText(/\/connect (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].split(' ');
  
  if (args.length < 1) {
    bot.sendMessage(chatId, '❌ يرجى إدخال ip على الأقل\nمثال: /connect play.example.com');
    return;
  }
  
  const host = args[0];
  const port = args[1] || '19132';
  const version = args[2] || '1.26.13.1';
  let duration = null;
  
  if (args.length >= 4) {
    const lastArg = args[args.length - 1];
    if (!isNaN(lastArg)) {
      duration = parseInt(lastArg);
    }
  }
  
  bot.sendMessage(chatId, `🔄 جاري الاتصال بـ ${host}:${port} (البيدروك)...`);
  createBedrockBot(host, port, version, duration, chatId);
});

bot.onText(/\/disconnect/, (msg) => {
  const chatId = msg.chat.id;
  if (mcBot) {
    try { mcBot.close(); } catch(e) {}
    bot.sendMessage(chatId, '✅ تم قطع الاتصال');
  } else {
    bot.sendMessage(chatId, '❌ لا يوجد اتصال حالياً');
  }
});

bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  if (mcBot) {
    const uptime = botStartTime ? Math.floor((Date.now() - botStartTime) / 60000) : 0;
    bot.sendMessage(chatId, `✅ البوت متصل\n⏱️ مدة الاتصال: ${uptime} دقيقة\n📍 السيرفر: ${mcBot.options?.host}:${mcBot.options?.port}`);
  } else {
    bot.sendMessage(chatId, '❌ البوت غير متصل حالياً');
  }
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
📚 الأوامر المتاحة للبيدروك:
/start - بدء التشغيل
/connect <ip> <port> [version] [duration] - الاتصال بالسيرفر
/disconnect - قطع الاتصال
/status - حالة البوت
/help - هذه الرسالة

أمثلة:
/connect pe.mcserver.com 19132 1.26.13.1 60
/connect 192.168.1.100 19132 120
  `, backKeyboard);
});

console.log('Telegram Bedrock bot is running...');
