const { Telegraf } = require('telegraf');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

// .env fayldan token va kalitlarni tekshirish
if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.GEMINI_API_KEY) {
    console.error("Xatolik: .env faylida TELEGRAM_BOT_TOKEN yoki GEMINI_API_KEY topilmadi!");
    process.exit(1);
}

// Bot va AI instansiyalarini yaratish
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const ADMIN_ID = process.env.ADMIN_ID; // Admin ID

// /start buyrug'i kelganda
bot.start((ctx) => {
    const ism = ctx.from.first_name || "Foydalanuvchi";
    ctx.reply(
        `Assalomu alaykum, ${ism}! 👋\n\nMen yangilangan Gemini AI modeli asosida ishlaydigan aqlli botman. ` +
        `Menga istalgan mavzuda (kodlash, fizika, matematika, tillar) savol berishingiz mumkin.`
    );
});

// /help buyrug'i kelganda
bot.help((ctx) => {
    ctx.reply("Menga shunchaki matnli xabar yuboring, men unga javob qaytaraman. Hozircha faqat matnli so'rovlarni qo'llab-quvvatlayman.");
});

// Har qanday matnli xabar kelganda
bot.on('text', async (ctx) => {
    const userMessage = ctx.message.text;
    const userId = ctx.from.id;
    const userName = ctx.from.first_name || "Noma'lum";
    const userUsername = ctx.from.username ? `@${ctx.from.username}` : "username yo'q";

    try {
        // Foydalanuvchiga bot "yozayotganini" bildirish
        await ctx.sendChatAction('typing');

        // Google'ning eng so'nggi barqaror va tezkor modeli
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: userMessage,
            config: {
                systemInstruction: "Siz o'zbek tilida mukammal so'zlashuvchi, muloyim va foydali yordamchisiz. Javoblaringiz qisqa, aniq va tushunarli bo'lsin.",
            }
        });

        // API versiyasiga qarab javob matnini xavfsiz usulda olish
        const replyText = response.text || (response.candidates?.[0]?.content?.parts?.[0]?.text);

        if (replyText) {
            // 1. Foydalanuvchiga javob qaytarish
            await ctx.reply(replyText);

            // 2. SIZGA (ADMIN'GA) XABAR YUBORISH (Agar yozgan odam siz bo'lmasangiz)
            if (ADMIN_ID && userId !== Number(ADMIN_ID)) {
                const logXabar = `🔔 **Yangi xabar!**\n` +
                                 `👤 Kimdan: ${userName} (${userUsername})\n` +
                                 `🆔 ID: \`${userId}\`\n\n` +
                                 `📝 **Foydalanuvchi:** ${userMessage}\n\n` +
                                 `🤖 **Gemini javobi:** ${replyText}`;
                
                await bot.telegram.sendMessage(ADMIN_ID, logXabar, { parse_mode: 'Markdown' });
            }
        } else {
            await ctx.reply("Uzr, ushbu so'rovga javob topa olmadim.");
        }

    } catch (error) {
        console.error("Xatolik yuz berdi:", error);
        await ctx.reply("Tizimda biroz uzilish bo'ldi. Iltimos, bir ozdan so'ng qayta urinib ko'ring.");
        
        // Xatolik haqida adminga hisobot yuborish
        if (ADMIN_ID) {
            const errorMsg = error.message || JSON.stringify(error);
            await bot.telegram.sendMessage(ADMIN_ID, `⚠️ Botda xatolik yuz berdi: ${errorMsg}`);
        }
    }
});

// Botni xatoliklarsiz o'chirish (Graceful shutdown)
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Botni ishga tushirish
bot.launch()
    .then(() => console.log("🚀 Telegram bot monitoring va yangi Gemini 2.5 modeli bilan ishga tushdi..."))
    .catch((err) => console.error("Botni ishga tushirishda xatolik:", err));