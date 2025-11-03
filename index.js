// 扩展的主脚本
// 以下是一些基本扩展功能的示例

//您可能需要从 extensions.js 导入 extension_settings、getContext 和 loadExtensionSettings

import { sendTextareaMessage, saveChatConditional } from '../../../../script.js';

// 跟踪扩展的位置，名称应与仓库名称匹配
const extensionName = 'MiddleGeneration';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}/`;
const defaultSettings = {
    sentMessages: [],
    // 存储最后点击的消息生成按钮的mesid
    lastGenHereMesId: null,
    // 是否开启索引工具栏
    enableScrollToolbar: true,
    // 是否显示消息生成按钮
    enableGenHereButton: true,
    // 是否显示插入模板按钮
    enableInsertTemplateButton: true,
    // 是否显示最近输入按钮
    enableImportButton: true,
    // 消息历史记录保留数量
    messageHistoryLimit: 100,
    // 消息插入模板格式
    messageInsertTemplateFormat: 'full',
    // 自定义模板格式
    customTemplateFormat: '',
};
const context = SillyTavern.getContext();
const { saveMetadata, eventSource, eventTypes } = context;

// 存储已发送消息的数组
let sentMessages = [];

// 如果扩展设置存在则加载，否则初始化为默认值。
async function loadSettings() {
    const extensionSettings = context.extensionSettings;

    // Create the settings if they don't exist
    extensionSettings[extensionName] = extensionSettings[extensionName] || {};
    if (Object.keys(extensionSettings[extensionName]).length === 0) {
        Object.assign(extensionSettings[extensionName], defaultSettings);
    }

    // 确保所有默认键都存在（在更新后很有用）
    for (const key of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(extensionSettings[extensionName], key)) {
            extensionSettings[extensionName][key] = defaultSettings[key];
        }
    }

    // 从 extensionSettings 加载存储的消息
    if (extensionSettings[extensionName].sentMessages) {
        sentMessages = extensionSettings[extensionName].sentMessages;
    }

    // 加载最后点击的消息生成按钮的mesid
    if (extensionSettings[extensionName].lastGenHereMesId !== undefined) {
        context.extensionSettings[extensionName].lastGenHereMesId = extensionSettings[extensionName].lastGenHereMesId;
    }

    // 加载索引工具栏设置
    if (extensionSettings[extensionName].enableScrollToolbar !== undefined) {
        context.extensionSettings[extensionName].enableScrollToolbar = extensionSettings[extensionName].enableScrollToolbar;
    }

    // 加载消息生成按钮设置
    if (extensionSettings[extensionName].enableGenHereButton !== undefined) {
        context.extensionSettings[extensionName].enableGenHereButton = extensionSettings[extensionName].enableGenHereButton;
    }

    // 加载插入模板按钮设置
    if (extensionSettings[extensionName].enableInsertTemplateButton !== undefined) {
        context.extensionSettings[extensionName].enableInsertTemplateButton = extensionSettings[extensionName].enableInsertTemplateButton;
    }

    // 加载最近输入按钮设置
    if (extensionSettings[extensionName].enableImportButton !== undefined) {
        context.extensionSettings[extensionName].enableImportButton = extensionSettings[extensionName].enableImportButton;
    }

    // 加载消息历史记录保留数量设置
    if (extensionSettings[extensionName].messageHistoryLimit !== undefined) {
        context.extensionSettings[extensionName].messageHistoryLimit = extensionSettings[extensionName].messageHistoryLimit;
    }

    // 加载消息插入模板格式设置
    if (extensionSettings[extensionName].messageInsertTemplateFormat !== undefined) {
        context.extensionSettings[extensionName].messageInsertTemplateFormat = extensionSettings[extensionName].messageInsertTemplateFormat;
    }

    // 加载自定义模板格式设置
    if (extensionSettings[extensionName].customTemplateFormat !== undefined) {
        context.extensionSettings[extensionName].customTemplateFormat = extensionSettings[extensionName].customTemplateFormat;
    }
}

// 将消息保存到 extensionSettings
function saveMessages() {
    const extensionSettings = context.extensionSettings;

    // 更新设置中的消息
    extensionSettings[extensionName].sentMessages = sentMessages;

    // 保存设置
    context.saveSettingsDebounced();
}

// 将消息添加到历史记录中
function addMessageToHistory(message) {
    if (message.trim() !== '') {
        const trimmedMessage = message.trim();
        const currentTime = new Date().toLocaleString();

        // 检查是否已存在相同内容的消息
        let messageExists = false;
        for (let i = 0; i < sentMessages.length; i++) {
            if (sentMessages[i].text.trim() === trimmedMessage) {
                // 如果存在相同内容的消息，更新时间戳
                sentMessages[i].timestamp = currentTime;
                messageExists = true;
                break;
            }
        }

        // 如果消息不存在，则添加新消息
        if (!messageExists) {
            sentMessages.push({
                text: trimmedMessage,
                timestamp: currentTime,
            });
        }

        // 仅保留最后 N 条消息（根据设置）
        const messageLimit = context.extensionSettings[extensionName].messageHistoryLimit || 100;
        if (sentMessages.length > messageLimit) {
            sentMessages.shift();
        }

        saveMessages();
        updateMessageHistoryPanel();
    }
}

// 清除消息历史记录
function clearMessageHistory() {
    sentMessages = [];
    saveMessages();
    updateMessageHistoryPanel();
}


// 消息历史记录面板相关函数
// 打开消息历史记录面板
function openMessageHistoryPanel() {
    // 如果面板不存在则创建面板
    if ($('#message_history_panel').length === 0) {
        // 加载CSS文件
        if ($('#db-toolbox-style').length === 0) {
            $('head').append(`<link id="db-toolbox-style" rel="stylesheet" type="text/css" href="${extensionFolderPath}/style.css">`);
        }

        $.get(`${extensionFolderPath}/message-panel.html`).then((html) => {
            $('body').append(html);
            updateMessageHistoryPanel();
            $('#message_history_panel').show();
        });
    } else {
        updateMessageHistoryPanel();
        $('#message_history_panel').show();
    }
}

// 关闭消息历史记录面板
function closeMessageHistoryPanel() {
    $('#message_history_panel').hide();
}

// 更新消息历史记录面板
function updateMessageHistoryPanel() {
    const messageList = $('#message_history_list');
    messageList.empty();

    if (sentMessages.length === 0) {
        messageList.append('<div class="no_messages">暂无消息历史记录</div>');
        return;
    }

    // Get search term
    const searchTerm = String($('#message_search').val()).toLowerCase();

    // Filter messages based on search term
    let filteredMessages = [];
    if (searchTerm) {
        for (let i = 0; i < sentMessages.length; i++) {
            if (sentMessages[i].text.toLowerCase().includes(searchTerm)) {
                filteredMessages.push({ index: i, message: sentMessages[i] });
            }
        }
    } else {
        // Add messages in reverse order (newest first)
        for (let i = sentMessages.length - 1; i >= 0; i--) {
            filteredMessages.push({ index: i, message: sentMessages[i] });
        }
    }

    if (filteredMessages.length === 0) {
        messageList.append('<div class="no_messages">未找到匹配的消息</div>');
        return;
    }

    // Display filtered messages
    for (let i = 0; i < filteredMessages.length; i++) {
        const item = filteredMessages[i];
        const messageElement = $(`
            <div class="message_item" data-index="${item.index}">
                <div class="message_text">${escapeHtml(item.message.text)}</div>
                <div class="side_panel">
                    <div class="button_row">
                        <button class="menu_button delete_message_btn" title="删除此消息">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                        <button class="menu_button use_message_btn" title="使用此消息">
                            <i class="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                    <div class="message_timestamp">${item.message.timestamp}</div>
                </div>
            </div>
        `);
        messageList.append(messageElement);
    }
}

// 转义 HTML 以防止 XSS 攻击
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function moveElement(arr, fromIndex, toIndex) {
    const element = arr.splice(fromIndex, 1)[0];
    arr.splice(toIndex, 0, element);
    return arr;
}

function findInChatCloneByIndex(allchat, targetIndex) {
    if (targetIndex < 0 || targetIndex >= allchat.length) {
        return 999999;
    }
    // 如果目标是系统消息，向前查找第一个非系统消息
    let actualIndex = targetIndex;
    while (actualIndex >= 0 && allchat[actualIndex].is_system === true) {
        actualIndex--;
    }
    // 如果向前找不到非系统消息，返回999999
    if (actualIndex < 0) {
        return 999999;
    }
    // 计算子集索引
    let systemCountBefore = 0;
    for (let i = 0; i < actualIndex; i++) {
        if (allchat[i].is_system === true) {
            systemCountBefore++;
        }
    }
    return actualIndex - systemCountBefore;
}

globalThis.middleGenerationInterceptor = async function(chat, contextSize, abort, type) {
    const allchat = context.chat;
    const genid = SillyTavern.getContext().chatMetadata['genid'];

    // 如果 genid 为 undefined，直接结束方法
    if (genid === undefined) {
        return;
    }

    const spliceid = findInChatCloneByIndex(allchat, parseInt(genid));
    chat.splice(spliceid + 1);
    chat.push(allchat[allchat.length - 1]);
};

async function handleMessageStop() {
    await saveChatConditional();
    const genid = SillyTavern.getContext().chatMetadata['genid'];

    // 如果 genid 为 undefined，直接结束方法
    if (genid === undefined) {
        return;
    }

    context.chat = moveElement(context.chat, context.chat.length - 1, parseInt(genid) + 1);
    // 移除用户消息
    await context.chat.pop();
    await saveChatConditional();
    await context.reloadCurrentChat();
    await saveChatConditional();
    scrollToMessage(parseInt(genid) + 1);
}

// 处理消息删除事件，直接移除 genid
function handle_message_deleted() {
    // 获取当前的 genid
    const genid = SillyTavern.getContext().chatMetadata['genid'];

    // 如果 genid 为 undefined，直接结束方法
    if (genid === undefined) {
        return;
    }

    // 直接移除 genid
    delete SillyTavern.getContext().chatMetadata['genid'];
    saveMetadata();
    // 移除所有消息生成按钮的高亮样式
    $('.mes_gen_here').removeClass('gen-here-active');
    toastr.info('消息已删除，生成位置设置已移除');
}

// 滚动到指定消息ID的函数
function scrollToMessage(mesid) {
    mesid = String(mesid);
    const chatDiv = document.getElementById('chat');
    const targetMessage = chatDiv.querySelector(`[mesid="${mesid}"]`);
    if (targetMessage) {
        // 平滑滚动到目标消息
        targetMessage.scrollIntoView({
            // behavior: 'smooth',
            block: 'start',
        });
        return true;
    } else {
        return false;
    }
}

// 初始化扩展
async function initializeExtension() {
    // 加载设置
    loadSettings();

    // 初始化UI
    await initializeUI();

    // 绑定事件
    bindEvents();
}

// 初始化UI
async function initializeUI() {
    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
    eventSource.on(eventTypes.GENERATION_ENDED, handleMessageStop);
    // 将 settingsHtml 追加到 extensions_settings
    // extension_settings 和 extensions_settings2 是设置菜单的左右两列
    // 左侧应为处理系统功能的扩展，右侧应为视觉/UI 相关的扩展
    $('#extensions_settings2').append(settingsHtml);

    // 设置复选框的初始状态
    const extensionSettings = context.extensionSettings[extensionName];
    $('#enable_scroll_toolbar').prop('checked', extensionSettings.enableScrollToolbar);
    $('#enable_gen_here_button').prop('checked', extensionSettings.enableGenHereButton);
    $('#enable_insert_template_button').prop('checked', extensionSettings.enableInsertTemplateButton);
    $('#enable_import_button').prop('checked', extensionSettings.enableImportButton);
    $('#message_history_limit').val(extensionSettings.messageHistoryLimit);
    $('#message_insert_template_format').val(extensionSettings.messageInsertTemplateFormat);
    $('#custom_template_format').val(extensionSettings.customTemplateFormat);

    // 根据模板格式选择显示/隐藏自定义模板容器
    if (extensionSettings.messageInsertTemplateFormat === 'custom') {
        $('#custom_template_container').show();
    } else {
        $('#custom_template_container').hide();
    }

    // 添加菜单项
    addMenuItems();

    // 根据设置决定是否添加导入按钮
    if (extensionSettings.enableImportButton) {
        addImportButton();
    }

    // 根据设置决定是否添加消息生成按钮
    if (extensionSettings.enableGenHereButton) {
        addMessageGenerationButton();
    }

    // 根据设置决定是否添加消息插入按钮
    if (extensionSettings.enableInsertTemplateButton) {
        addMessageInsertButton();
    }

    // 根据设置决定是否添加消息滚动工具栏
    if (extensionSettings.enableScrollToolbar) {
        addMessageScrollToolbar();
    }

    // 如果存在genid，则高亮对应的按钮
    eventSource.on(eventTypes.CHAT_CHANGED, highlightGenHereButton);
    eventSource.on(eventTypes.CHAT_CHANGED, () => {
        if (context.extensionSettings[extensionName].enableScrollToolbar) {
            addMessageScrollToolbar();
        }
    });
    eventSource.on(eventTypes.CHAT_CHANGED , () => {
        onGenidScrollClick();
    });
    eventSource.on(eventTypes.MESSAGE_DELETED, () => {
        handle_message_deleted();
    });
    eventSource.on(eventTypes.MESSAGE_UPDATED, (event) => {
        toastr.info('消息已更新，取消生成位置设置');
        console.log(event);
    });
    eventSource.on(eventTypes.MESSAGE_EDITED, (event) => {
        toastr.info('消息已编辑，取消生成位置设置');
        console.log(event);
    });
}

// 添加菜单项
function addMenuItems() {
    const menuItemHtml = `
        <div id="${extensionName}_wand_container" class="extension_container interactable" tabindex="0">
            <div id="${extensionName}_menu_item" class="list-group-item flex-container flexGap5 interactable"
                 title="输入历史记录" tabindex="0" role="listitem">
                <div class="fa-fw fa-solid fa-toolbox extensionsMenuExtensionButton"></div>
                <span>输入历史记录</span>
            </div>
        </div>
    `;
    $('#extensionsMenu').append(menuItemHtml);
}

// 添加导入按钮
function addImportButton() {
    const importHtml = `
    <div id="import_but" class="fa-solid fa-history interactable" title="最近输入" tabindex="0" role="button" style="margin-left: 10px;"></div>
    `;
    $('#rightSendForm').append(importHtml);
}

// 添加消息生成按钮
function addMessageGenerationButton() {
    const mesbutton = '<div title="从此往下生成" class="mes_button mes_gen_here fa-solid fa-wand-magic-sparkles interactable" tabindex="0" role="button"></div>';
    $('.mes_buttons').append(mesbutton);
}

// 添加消息插入按钮
function addMessageInsertButton() {
    const mesbutton = '<div title="插入模板到输入框" class="mes_button mes_insert_template fa-solid fa-arrow-right-to-bracket interactable" tabindex="0" role="button"></div>';
    $('.mes_buttons').append(mesbutton);
}

// 添加消息滚动工具栏
function addMessageScrollToolbar() {
    // 如果工具栏已存在，则不重复添加
    if ($('#messageScrollToolbar').length > 0) {
        return;
    }

    // 创建滚动工具栏HTML
    const toolbarHtml = `
        <div id="messageScrollToolbar" class="scroll-toolbar">
            <button id="decrementMesidBtn" class="menu_button" title="减小mesid值">
                <i class="fa-solid fa-minus"></i>
            </button>
            <input type="text" id="mesidInput" class="mesid-input" placeholder="mesid">
            <button id="incrementMesidBtn" class="menu_button" title="增加mesid值">
                <i class="fa-solid fa-plus"></i>
            </button>
            <button id="scrollToMessageBtn" class="menu_button" title="滚动到消息">
                <i class="fa-solid fa-arrow-down"></i>
            </button>
            <button id="genidScrollBtn" class="menu_button" title="滚动到genid消息">
                <i class="fa-solid fa-location-arrow"></i>
            </button>
        </div>
    `;

    // 将工具栏添加到body元素
    $('#sheld').append(toolbarHtml);
    $('#mesidInput').val(SillyTavern.getContext().chatMetadata['genid'] || '');
}

// 高亮显示消息生成按钮
function highlightGenHereButton() {
    const genid = SillyTavern.getContext().chatMetadata['genid'];
    if (genid !== undefined) {
        toastr.info(`当前生成位置ID: ${genid}`);
        // 移除所有按钮的高亮样式
        $('.mes_gen_here').removeClass('gen-here-active');

        // 为对应mesid的消息按钮添加高亮样式
        $(`.mes[mesid="${genid}"] .mes_gen_here`).addClass('gen-here-active');
    }
}

// 绑定事件
function bindEvents() {

    // 绑定菜单项点击事件
    $(`#${extensionName}_menu_item`).on('click', function() {
        openMessageHistoryPanel();
    });

    // 绑定导入按钮点击事件
    $('#import_but').on('click', onImportButtonClick);

    // 处理使用消息按钮的点击事件
    $(document).on('click', '.use_message_btn', onUseMessageButtonClick);

    // 处理删除单条消息按钮
    $(document).on('click', '.delete_message_btn', onDeleteMessageButtonClick);


    // 处理搜索框输入事件
    $(document).on('input', '#message_search', onMessageSearchInput);

    // 处理清除历史记录按钮
    $(document).on('click', '#clear_message_history', onClearMessageHistoryClick);

    // 点击外部时关闭面板
    $(document).on('click', onDocumentClick);

    // 绑定关闭面板按钮点击事件
    $(document).on('click', '#close_message_history_panel', closeMessageHistoryPanel);

    // 绑定发送按钮点击事件
    $('#send_but').off('click');
    $('#send_but').on('click', onSendButtonClick);

    // 绑定消息生成按钮点击事件
    $(document).on('click', '.mes_gen_here', onMessageGenerationClick);

    // 绑定消息插入按钮点击事件
    $(document).on('click', '.mes_insert_template', onMessageInsertClick);

    // 绑定重置消息历史记录按钮点击事件
    $(document).on('click', '#reset_message_history', onResetMessageHistoryClick);

    // 绑定mesid输入框回车事件
    $(document).on('keypress', '#mesidInput', onMesidInputKeypress);

    // 绑定滚动按钮点击事件
    $(document).on('click', '#scrollToMessageBtn', onScrollToMessageClick);

    // 绑定增加mesid按钮点击事件
    $(document).on('click', '#incrementMesidBtn', onIncrementMesidClick);

    // 绑定减小mesid按钮点击事件
    $(document).on('click', '#decrementMesidBtn', onDecrementMesidClick);

    // 绑定genid滚动按钮点击事件
    $(document).on('click', '#genidScrollBtn', onGenidScrollClick);

    // 绑定索引工具栏设置复选框事件
    $(document).on('change', '#enable_scroll_toolbar', onEnableScrollToolbarChange);

    // 绑定消息生成按钮设置复选框事件
    $(document).on('change', '#enable_gen_here_button', onEnableGenHereButtonChange);

    // 绑定插入模板按钮设置复选框事件
    $(document).on('change', '#enable_insert_template_button', onEnableInsertTemplateButtonChange);

    // 绑定最近输入按钮设置复选框事件
    $(document).on('change', '#enable_import_button', onEnableImportButtonChange);

    // 绑定消息历史记录保留数量设置事件
    $(document).on('change', '#message_history_limit', onMessageHistoryLimitChange);

    // 绑定消息插入模板格式设置事件
    $(document).on('change', '#message_insert_template_format', onMessageInsertTemplateFormatChange);

    // 绑定自定义模板格式设置事件
    $(document).on('input', '#custom_template_format', onCustomTemplateFormatChange);
}

// 导入按钮点击事件
function onImportButtonClick() {
    // 将最后发送的消息插入到文本区域
    if (sentMessages.length > 0) {
        const lastMessage = sentMessages[sentMessages.length - 1].text;
        const textarea = $('#send_textarea');
        textarea.val(lastMessage);
        // Trigger input event to update UI
        textarea.trigger('input');
    }
}

// 使用消息按钮点击事件
function onUseMessageButtonClick() {
    const messageText = $(this).closest('.message_item').find('.message_text').text();
    const textarea = $('#send_textarea');
    textarea.val(messageText);
    // Trigger input event to update UI
    textarea.trigger('input');
    closeMessageHistoryPanel();
}

// 插入消息按钮点击事件

// 删除消息按钮点击事件
function onDeleteMessageButtonClick(e) {
    // 阻止事件冒泡，防止触发关闭面板的document click事件
    e.stopPropagation();

    const index = parseInt($(this).closest('.message_item').data('index'));
    if (!isNaN(index) && index >= 0 && index < sentMessages.length) {
        // Remove the message at the specified index
        sentMessages.splice(index, 1);
        saveMessages();
        updateMessageHistoryPanel();
    }
}

// 消息搜索输入事件
function onMessageSearchInput() {
    updateMessageHistoryPanel();
}

// 清除消息历史记录点击事件
function onClearMessageHistoryClick() {
    clearMessageHistory();
}

// 重置消息历史记录点击事件
function onResetMessageHistoryClick() {
    // 显示确认对话框
    if (confirm('确定要重置消息历史记录吗？这将清除所有历史消息。')) {
        clearMessageHistory();
    }
}

// 文档点击事件
function onDocumentClick(e) {
    const panel = $('#message_history_panel');
    const target = $(e.target);
    if (panel.is(':visible') && !target.closest('#message_history_panel').length &&
        !target.closest(`#${extensionName}_menu_item`).length) {
        closeMessageHistoryPanel();
    }
}

// mesid输入框回车事件
function onMesidInputKeypress(e) {
    if (e.which === 13) { // 回车键
        const mesid = $(this).val().trim();
        if (mesid) {
            // 调用已有的scrollToMessage函数
            scrollToMessage(mesid);
        }
    }

}

// 滚动按钮点击事件
function onScrollToMessageClick() {
    const mesid = String($('#mesidInput').val()).trim();
    if (mesid) {
        // 调用已有的scrollToMessage函数
        scrollToMessage(mesid);
    }
}
// 增加mesid值按钮点击事件
function onIncrementMesidClick() {
    const mesidInput = $('#mesidInput');
    let mesid = parseInt(String(mesidInput.val())) || 0;

    // 获取当前chat内存在的最大mesid
    const chatDiv = document.getElementById('chat');
    const messages = chatDiv.querySelectorAll('.mes[mesid]');
    let maxMesid = -1;

    messages.forEach(message => {
        const messageId = parseInt(message.getAttribute('mesid'));
        if (!isNaN(messageId) && messageId > maxMesid) {
            maxMesid = messageId;
        }
    });

    // 只有当mesid小于最大mesid时才增加
    if (mesid < maxMesid) {
        mesid++;
        mesidInput.val(mesid);

        // 执行滚动到消息
        scrollToMessage(mesid);
    }
}

// 减小mesid值按钮点击事件
function onDecrementMesidClick() {
    const mesidInput = $('#mesidInput');
    let mesid = parseInt(String(mesidInput.val())) || 0;
    mesid = Math.max(0, mesid - 1); // 确保不小于0
    mesidInput.val(mesid);

    // 执行滚动到消息
    scrollToMessage(mesid);
}

// genid滚动按钮点击事件
function onGenidScrollClick() {
    const context = SillyTavern.getContext();
    let genid = context.chatMetadata['genid'];
    // 如果genid是undefined，则设置为当前chat内存在的最大mesid
    if (genid === undefined) {
        const chatDiv = document.getElementById('chat');
        const messages = chatDiv.querySelectorAll('.mes[mesid]');
        let maxMesid = -1;

        messages.forEach(message => {
            const mesid = parseInt(message.getAttribute('mesid'));
            if (!isNaN(mesid) && mesid > maxMesid) {
                maxMesid = mesid;
            }
        });

        genid = maxMesid >= 0 ? maxMesid : 0;
    }

    // 将genid值设置到输入框中
    $('#mesidInput').val(genid);

    // 执行滚动到消息
    scrollToMessage(genid);
}

// 发送按钮点击事件
async function onSendButtonClick() {
    const textareaText = String($('#send_textarea').val());
    toastr.info(SillyTavern.getContext().chatMetadata['genid'], '当前生成位置ID');
    addMessageToHistory(textareaText);
    sendTextareaMessage();
}

// 消息生成点击事件
async function onMessageGenerationClick() {
    const context = SillyTavern.getContext();
    const mesDiv = $(this).closest('.mes');
    if (mesDiv.length) {
        const mesid = mesDiv.attr('mesid');
        const thisChat = context.chat[parseInt(mesid)];
        if (thisChat.is_system === true) {
            toastr.error('无法从隐藏消息开始生成，请选择可见消息');
            return;
        }
        // 检查是否已经高亮，如果是则移除genid
        if (context.chatMetadata['genid'] === mesid) {
            $('.gen-here-active').removeClass('gen-here-active');
            toastr.info('已取消生成位置设置');
            // 移除genid
            delete context.chatMetadata['genid'];
            await saveMetadata();
        } else {
            // 设置新的genid
            context.chatMetadata['genid'] = mesid;
            $('.gen-here-active').removeClass('gen-here-active');
            $(this).addClass('gen-here-active');
            $('#mesidInput').val(mesid);
            toastr.info(`将从 #${mesid} 后开始生成消息`);
            await saveMetadata();
            await eventSource.emit('GENID_CHANGED', mesid);
        }
    }
}



// 消息插入点击事件
async function onMessageInsertClick() {
    const context = SillyTavern.getContext();
    // 获取当前消息的文本内容
    const mesDiv = $(this).closest('.mes');
    if (mesDiv.length) {
        const messageText = mesDiv.find('.mes_text').text();
        const textarea = $('#send_textarea');

        // 获取模板格式设置
        const templateFormat = context.extensionSettings[extensionName].messageInsertTemplateFormat || 'full';
        const customTemplate = context.extensionSettings[extensionName].customTemplateFormat || '';

        let templeteText = '';

        switch (templateFormat) {
            case 'short':
                // 简化格式
                templeteText = `请修改以下内容：\n${messageText}\n`;
                break;
            case 'custom':
                // 自定义格式，支持 {message}、{message:n}、{message:-n} 占位符
                if (customTemplate) {
                    templeteText = customTemplate.replace(/{message(?::(-?\d+))?}/g, (match, length) => {
                        if (length === undefined) {
                            // {message} - 完整消息
                            return messageText;
                        } else {
                            const len = parseInt(length);
                            if (len > 0) {
                                // {message:n} - 前n个字符
                                return messageText.substring(0, len);
                            } else if (len < 0) {
                                // {message:-n} - 后n个字符
                                return messageText.substring(messageText.length + len);
                            } else {
                                // {message:0} - 空字符串
                                return '';
                            }
                        }
                    });
                } else {
                    // 如果没有自定义模板，使用默认格式
                    templeteText = `请完整修改以上正文内容。\n正文为【${messageText}】\n`;
                }
                break;
            case 'full':
            default:
                // 完整格式（默认）
                if (messageText.length > 100) {
                    const messageTextFirst30 = messageText.substring(0, 30);
                    const messageTextLast30 = messageText.substring(messageText.length - 30);
                    templeteText = `请完整修改以上正文内容。\n新生成的正文需要以【${messageTextFirst30}】为开头，以【${messageTextLast30}】为结尾。\n`;
                } else {
                    templeteText = `请完整修改以上正文内容。\n正文为【${messageText}】\n`;
                }
                break;
        }

        textarea.val(templeteText);
        // 触发input事件以更新UI
        textarea.trigger('input');
    }
}

// 索引工具栏设置复选框事件
function onEnableScrollToolbarChange() {
    const isChecked = $(this).prop('checked');
    context.extensionSettings[extensionName].enableScrollToolbar = isChecked;
    context.saveSettingsDebounced();

    if (isChecked) {
        // 如果启用，添加工具栏
        addMessageScrollToolbar();
    } else {
        // 如果禁用，移除工具栏
        $('#messageScrollToolbar').remove();
    }
}

// 消息生成按钮设置复选框事件
function onEnableGenHereButtonChange() {
    const isChecked = $(this).prop('checked');
    context.extensionSettings[extensionName].enableGenHereButton = isChecked;
    context.saveSettingsDebounced();

    if (isChecked) {
        // 如果启用，添加消息生成按钮
        addMessageGenerationButton();
    } else {
        // 如果禁用，移除消息生成按钮
        $('.mes_gen_here').remove();
    }
}

// 插入模板按钮设置复选框事件
function onEnableInsertTemplateButtonChange() {
    const isChecked = $(this).prop('checked');
    context.extensionSettings[extensionName].enableInsertTemplateButton = isChecked;
    context.saveSettingsDebounced();

    if (isChecked) {
        // 如果启用，添加插入模板按钮
        addMessageInsertButton();
    } else {
        // 如果禁用，移除插入模板按钮
        $('.mes_insert_template').remove();
    }
}

// 最近输入按钮设置复选框事件
function onEnableImportButtonChange() {
    const isChecked = $(this).prop('checked');
    context.extensionSettings[extensionName].enableImportButton = isChecked;
    context.saveSettingsDebounced();

    if (isChecked) {
        // 如果启用，添加最近输入按钮
        addImportButton();
    } else {
        // 如果禁用，移除最近输入按钮
        $('#import_but').remove();
    }
}

// 消息历史记录保留数量设置事件
function onMessageHistoryLimitChange() {
    const value = parseInt($(this).val());
    if (!isNaN(value) && value > 0) {
        context.extensionSettings[extensionName].messageHistoryLimit = value;
        context.saveSettingsDebounced();

        // 如果当前消息数量超过限制，删除多余的消息
        if (sentMessages.length > value) {
            sentMessages = sentMessages.slice(-value);
            saveMessages();
            updateMessageHistoryPanel();
        }
    }
}

// 消息插入模板格式设置事件
function onMessageInsertTemplateFormatChange() {
    const value = $(this).val();
    context.extensionSettings[extensionName].messageInsertTemplateFormat = value;
    context.saveSettingsDebounced();

    // 根据选择显示/隐藏自定义模板容器
    if (value === 'custom') {
        $('#custom_template_container').show();
    } else {
        $('#custom_template_container').hide();
    }
}

// 自定义模板格式设置事件
function onCustomTemplateFormatChange() {
    const value = $(this).val();
    context.extensionSettings[extensionName].customTemplateFormat = value;
    context.saveSettingsDebounced();
}

// 当扩展加载时调用此函数
jQuery(async () => {
    initializeExtension();
});
