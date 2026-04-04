/** Bot i18n messages — single source of truth for all Telegram reply texts. */
export const botMessages = {
    uz: {
        start: "Assalomu alaykum! Buyurtmalaringiz bo'yicha siz bilan bog'lanishimiz uchun telefon raqamingizni ulashing.",
        startWithPhone:
            "Assalomu alaykum! Telefon raqamingiz saqlangan. Do'konimizga xush kelibsiz!",
        generic: "Iltimos, quyidagi tugma orqali telefon raqamingizni ulashing.",
        genericWithPhone: "Do'konimizga kirish uchun quyidagi tugmani bosing.",
        shareButton: "📱 Raqamni ulashish",
        openShop: "📲 Ochish",
        menuButton: "Ochish",
        shopPrompt: "Buyurtma berish uchun quyidagi tugmani bosing:",
    },
    ru: {
        start: "Здравствуйте! Поделитесь номером телефона, чтобы мы могли связаться с вами по заказам.",
        startWithPhone: "Здравствуйте! Ваш номер сохранён. Добро пожаловать в наш магазин!",
        generic: "Пожалуйста, поделитесь номером телефона через кнопку ниже.",
        genericWithPhone: "Нажмите кнопку ниже, чтобы открыть магазин.",
        shareButton: "📱 Поделиться номером",
        openShop: "📲 Открыть",
        menuButton: "Открыть",
        shopPrompt: "Нажмите кнопку ниже для оформления заказа:",
    },
};

export const contactMessages = {
    uz: {
        processingError: "Kontaktni qayta ishlashda xatolik. Qayta urinib ko'ring.",
        wrongContact: "Iltimos, o'zingizning kontaktingizni ulashing.",
        invalidPhone: "Telefon raqam formati noto'g'ri. Qayta urinib ko'ring.",
        success: "Rahmat! Telefon raqamingiz saqlandi.",
        phoneTaken:
            "Bu raqam boshqa akkauntga biriktirilgan. Qo'llab-quvvatlash xizmatiga murojaat qiling.",
        userNotFound: "Akkauntingiz topilmadi. Avval saytga kiring.",
        alreadyHasPhone: "Telefon raqamingiz allaqachon saqlangan!",
        genericError: "Xatolik yuz berdi. Keyinroq qayta urinib ko'ring.",
    },
    ru: {
        processingError: "Ошибка обработки контакта. Попробуйте ещё раз.",
        wrongContact: "Пожалуйста, поделитесь своим контактом, а не чужим.",
        invalidPhone: "Неверный формат номера. Попробуйте ещё раз.",
        success: "Спасибо! Ваш номер телефона сохранён.",
        phoneTaken: "Этот номер уже привязан к другому аккаунту. Обратитесь в поддержку.",
        userNotFound: "Аккаунт не найден. Сначала войдите на сайт.",
        alreadyHasPhone: "Ваш номер телефона уже сохранён!",
        genericError: "Произошла ошибка. Попробуйте позже.",
    },
};

export const debtReminderMessages = {
    uz: {
        reminder: (fullname: string, balance: string) =>
            `Hurmatli ${fullname}, sizning qarzdorligingiz: ${balance} so'm. Iltimos, o'z vaqtida to'lang.`,
    },
    ru: {
        reminder: (fullname: string, balance: string) =>
            `Уважаемый(ая) ${fullname}, ваша задолженность: ${balance} сум. Пожалуйста, оплатите вовремя.`,
    },
};
