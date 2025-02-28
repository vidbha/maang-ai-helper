// Content Script for Browser Extension
(function () {
    /** Utility: Set up copy buttons for code blocks */
    function setupCopyButtons() {
        document.addEventListener('click', function (e) {
            if (e.target && e.target.classList.contains('copy-code-button')) {
                const codeBlock = e.target.previousElementSibling;
                if (codeBlock && codeBlock.textContent) {
                    navigator.clipboard.writeText(codeBlock.textContent).then(function () {
                        e.target.textContent = 'Copied!';
                        setTimeout(() => { e.target.textContent = 'Copy'; }, 2000);
                    });
                }
            }
        });
    }

    /** Extract Problem Details for context */
    function extractProblemDetails() {
        const titleElem = document.querySelector('h1, .problem-title');
        const title = titleElem ? titleElem.innerText.trim() : "Unknown Title";

        const descriptionElem = document.querySelector('.problem-description, .coding_desc__pltWY');
        const description = descriptionElem ? descriptionElem.innerText.trim() : "No description available.";

        const constraintsElem = document.querySelector('.constraints');
        const constraints = constraintsElem ? constraintsElem.innerText.trim() : "No constraints provided.";

        const sampleInputs = Array.from(document.querySelectorAll('.sample-input'))
            .map(el => el.innerText.trim()).join('\n') || "No sample inputs available.";
        
        const sampleOutputs = Array.from(document.querySelectorAll('.sample-output'))
            .map(el => el.innerText.trim()).join('\n') || "No sample outputs available.";

        return `**Problem Title:** ${title}\n\n**Description:** ${description}\n\n**Constraints:** ${constraints}\n\n**Sample Inputs:**\n${sampleInputs}\n\n**Sample Outputs:**\n${sampleOutputs}`;
    }

    /** API Call: Fetch AI Response from Gemini API with context */
    async function fetchGeminiResponse(apiKey, chatHistory) {
        try {
            // Prepend problem context.
            const problemContext = extractProblemDetails();
            chatHistory.unshift(`**Context:**\n${problemContext}`);

            // Add an instruction for conciseness.
            chatHistory.unshift("Based on the context provided above, answer the user's query accurately and concisely.");

            // Append hint mode if enabled.
            const hintModeCheckbox = document.getElementById('hintMode');
            if (hintModeCheckbox && hintModeCheckbox.checked) {
                chatHistory.push("Please provide hints instead of a full solution.");
            }

            // Include the preferred programming language.
            const languageDropdown = document.getElementById('preferredLanguage');
            if (languageDropdown && languageDropdown.value) {
                chatHistory.push(`Preferred Programming Language: ${languageDropdown.value}`);
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: chatHistory.map(msg => ({ text: msg })) }] })
            });
            const data = await response.json();
            return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI.";
        } catch (error) {
            console.error("Error fetching response from Gemini API:", error);
            return "Error communicating with AI.";
        }
    }

    /** Open a larger, Gemini-styled AI Assistant window */
    function openAIPopup() {
        let apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            apiKey = prompt('Enter your Gemini API Key:');
            if (apiKey) localStorage.setItem('gemini_api_key', apiKey);
            else return;
        }

        // Remove existing popup if open.
        const existingPopup = document.getElementById('aiPopup');
        if (existingPopup) document.body.removeChild(existingPopup);

        // Create the main popup container.
        const popup = document.createElement('div');
        popup.id = 'aiPopup';
        popup.style.position = 'fixed';
        popup.style.top = '50%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
        popup.style.width = '700px';
        popup.style.height = '650px';
        popup.style.backgroundColor = '#fff';
        popup.style.borderRadius = '10px';
        popup.style.boxShadow = '0px 4px 20px rgba(0,0,0,0.2)';
        popup.style.display = 'flex';
        popup.style.flexDirection = 'column';
        popup.style.zIndex = '99999';

        // Header (Gemini-style)
        const header = document.createElement('div');
        header.style.backgroundColor = '#1677ff';
        header.style.color = '#fff';
        header.style.padding = '15px';
        header.style.borderTopLeftRadius = '10px';
        header.style.borderTopRightRadius = '10px';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.innerHTML = '<span style="font-size:18px; font-weight:bold;">Gemini AI Assistant</span>';
        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        closeButton.style.background = 'transparent';
        closeButton.style.border = 'none';
        closeButton.style.color = '#fff';
        closeButton.style.fontSize = '18px';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = () => { document.body.removeChild(popup); };
        header.appendChild(closeButton);
        popup.appendChild(header);

        // Chat container area.
        const chatContainer = document.createElement('div');
        chatContainer.id = 'chatContainer';
        chatContainer.style.flexGrow = '1';
        chatContainer.style.padding = '15px';
        chatContainer.style.overflowY = 'auto';
        chatContainer.style.backgroundColor = '#f9f9f9';
        chatContainer.style.fontFamily = 'Arial, sans-serif';
        popup.appendChild(chatContainer);

        // Input & Controls container.
        const inputContainer = document.createElement('div');
        inputContainer.style.display = 'flex';
        inputContainer.style.flexDirection = 'column';
        inputContainer.style.padding = '15px';
        inputContainer.style.borderTop = '1px solid #eaeaea';

        // Predefined prompt buttons.
        const promptsContainer = document.createElement('div');
        promptsContainer.style.marginBottom = '10px';
        const prompts = [
            { label: "Explain Problem", text: "Explain this problem in detail:" },
            { label: "Sample Solution", text: "Provide a sample solution for this problem:" },
            { label: "Optimize Code", text: "Suggest optimizations for my code:" },
            { label: "Debug Code", text: "Help debug my code:" }
        ];
        prompts.forEach(promptObj => {
            const btn = document.createElement('button');
            btn.textContent = promptObj.label;
            btn.style.marginRight = '8px';
            btn.style.marginBottom = '5px';
            btn.style.padding = '6px 12px';
            btn.style.border = 'none';
            btn.style.borderRadius = '4px';
            btn.style.backgroundColor = '#1677ff';
            btn.style.color = '#fff';
            btn.style.cursor = 'pointer';
            btn.onclick = () => { document.getElementById('aiQuery').value = promptObj.text; };
            promptsContainer.appendChild(btn);
        });
        inputContainer.appendChild(promptsContainer);

        // Query Textarea.
        const aiQuery = document.createElement('textarea');
        aiQuery.id = 'aiQuery';
        aiQuery.placeholder = 'Type your question...';
        aiQuery.style.width = '100%';
        aiQuery.style.height = '80px';
        aiQuery.style.padding = '10px';
        aiQuery.style.marginBottom = '10px';
        aiQuery.style.border = '1px solid #ccc';
        aiQuery.style.borderRadius = '4px';
        aiQuery.style.resize = 'none';
        inputContainer.appendChild(aiQuery);

        // Controls: Language selection and Hint Mode.
        const controlsContainer = document.createElement('div');
        controlsContainer.style.display = 'flex';
        controlsContainer.style.justifyContent = 'space-between';
        controlsContainer.style.marginBottom = '10px';

        // Language dropdown.
        const languageSelect = document.createElement('select');
        languageSelect.id = 'preferredLanguage';
        languageSelect.style.padding = '6px';
        const languages = ["JavaScript", "Python", "Java", "C++", "C#", "Ruby"];
        languages.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang;
            option.textContent = lang;
            languageSelect.appendChild(option);
        });
        controlsContainer.appendChild(languageSelect);

        // Hint Mode toggle.
        const hintModeContainer = document.createElement('div');
        hintModeContainer.style.display = 'flex';
        hintModeContainer.style.alignItems = 'center';
        const hintModeCheckbox = document.createElement('input');
        hintModeCheckbox.type = 'checkbox';
        hintModeCheckbox.id = 'hintMode';
        hintModeCheckbox.style.marginRight = '5px';
        hintModeContainer.appendChild(hintModeCheckbox);
        const hintModeLabel = document.createElement('label');
        hintModeLabel.textContent = 'Hint Mode';
        hintModeContainer.appendChild(hintModeLabel);
        controlsContainer.appendChild(hintModeContainer);
        inputContainer.appendChild(controlsContainer);

        // API Key management and Share buttons.
        const apiShareContainer = document.createElement('div');
        apiShareContainer.style.display = 'flex';
        apiShareContainer.style.justifyContent = 'space-between';
        apiShareContainer.style.marginBottom = '10px';

        const manageApiKeyButton = document.createElement('button');
        manageApiKeyButton.textContent = 'Manage API Key';
        manageApiKeyButton.style.padding = '6px 12px';
        manageApiKeyButton.style.backgroundColor = '#28a745';
        manageApiKeyButton.style.color = '#fff';
        manageApiKeyButton.style.border = 'none';
        manageApiKeyButton.style.borderRadius = '4px';
        manageApiKeyButton.style.cursor = 'pointer';
        manageApiKeyButton.onclick = () => {
            const newApiKey = prompt('Enter new Gemini API Key:');
            if (newApiKey) {
                localStorage.setItem('gemini_api_key', newApiKey);
                alert('API Key updated!');
            }
        };
        apiShareContainer.appendChild(manageApiKeyButton);

        const shareDoubtButton = document.createElement('button');
        shareDoubtButton.textContent = 'Share Doubt';
        shareDoubtButton.style.padding = '6px 12px';
        shareDoubtButton.style.backgroundColor = '#17a2b8';
        shareDoubtButton.style.color = '#fff';
        shareDoubtButton.style.border = 'none';
        shareDoubtButton.style.borderRadius = '4px';
        shareDoubtButton.style.cursor = 'pointer';
        shareDoubtButton.onclick = () => {
            navigator.clipboard.writeText(window.location.href).then(() => {
                alert('Page URL copied to clipboard!');
            });
        };
        apiShareContainer.appendChild(shareDoubtButton);
        inputContainer.appendChild(apiShareContainer);

        // Send button.
        const sendButton = document.createElement('button');
        sendButton.textContent = 'Send';
        sendButton.style.width = '100%';
        sendButton.style.padding = '10px';
        sendButton.style.backgroundColor = '#1677ff';
        sendButton.style.color = '#fff';
        sendButton.style.border = 'none';
        sendButton.style.borderRadius = '4px';
        sendButton.style.cursor = 'pointer';
        inputContainer.appendChild(sendButton);

        popup.appendChild(inputContainer);
        document.body.appendChild(popup);

        // Chat history management (persist per problem page).
        const chatHistoryKey = `chat_history_${window.location.pathname}`;
        let chatHistory = JSON.parse(localStorage.getItem(chatHistoryKey)) || [];

        function updateChatUI() {
            chatContainer.innerHTML = chatHistory.join('');
            chatContainer.scrollTop = chatContainer.scrollHeight;
            setupCopyButtons();
        }
        updateChatUI();

        // Event handler for Send button.
        sendButton.addEventListener('click', async () => {
            // Capture and then clear the user query immediately.
            const userQueryText = aiQuery.value;
            if (!userQueryText.trim()) return;
            aiQuery.value = ""; // Clear the prompt immediately

            // Check for queries about the problem name/topic.
            if (/name.*problem/i.test(userQueryText) || /problem.*name/i.test(userQueryText) || /what.*(problem|topic)/i.test(userQueryText)) {
                const titleElem = document.querySelector('h1, .problem-title');
                const title = titleElem ? titleElem.innerText.trim() : "Unknown Title";
                const directAnswer = `<div style="background: #f1f1f1; padding: 10px; border-radius: 8px; margin: 8px 0; max-width: 90%; font-family: Arial, sans-serif;">
                    <strong>🤖 AI Assistant:</strong><br>The problem name is: <strong>${title}</strong>.
                </div>`;
                chatHistory.push(directAnswer);
                localStorage.setItem(chatHistoryKey, JSON.stringify(chatHistory));
                updateChatUI();
                return;
            }

            // Append the user's message.
            const userMessageHtml = `<div style="text-align: right; margin: 8px 0; font-family: Arial, sans-serif;">
                <strong>You:</strong><br>${userQueryText.replace(/\n/g, "<br>")}
            </div>`;
            chatHistory.push(userMessageHtml);
            updateChatUI();

            // Include any selected text from the page for extra context.
            const selectedText = window.getSelection().toString().trim();
            const fullUserQuery = selectedText ? `${userQueryText}\n\nContext: ${selectedText}` : userQueryText;

            // Fetch the AI response.
            const aiResponseText = await fetchGeminiResponse(apiKey, [fullUserQuery]);
            const aiMessageHtml = `<div style="background: #f1f1f1; padding: 10px; border-radius: 8px; margin: 8px 0; max-width: 90%; font-family: Arial, sans-serif;">
                <strong>🤖 AI Assistant:</strong><br>${aiResponseText.replace(/\n/g, "<br>")}
            </div>`;
            chatHistory.push(aiMessageHtml);
            localStorage.setItem(chatHistoryKey, JSON.stringify(chatHistory));
            updateChatUI();
        });
    }

    /** Add the doubt button near the problem title (unchanged location) */
    function addDoubtButton() {
        const problemTitle = document.querySelector('h1, div.ant-typography-h1, .problem-title, .css-1ydn1gj');
        if (!problemTitle) return;
        if (document.getElementById('doubtButton')) return;
        const doubtButton = document.createElement('button');
        doubtButton.id = 'doubtButton';
        doubtButton.style.marginLeft = '10px';
        doubtButton.style.cursor = 'pointer';
        doubtButton.style.border = 'none';
        doubtButton.style.background = 'transparent';
        doubtButton.style.padding = '5px';
        doubtButton.style.transition = '0.3s';
        const doubtIcon = document.createElement('img');
        const imageUrl = chrome.runtime.getURL('doubt-icon.png');
        doubtIcon.src = imageUrl;
        doubtIcon.alt = 'Doubt Icon';
        doubtIcon.style.width = '24px';
        doubtIcon.style.height = '24px';
        doubtButton.appendChild(doubtIcon);
        doubtButton.addEventListener('click', openAIPopup);
        problemTitle.parentNode.insertBefore(doubtButton, problemTitle.nextSibling);
    }

    /** Observe DOM changes to ensure the doubt button is present */
    function observeProblemChanges() {
        const observer = new MutationObserver((mutations, obs) => {
            const problemTitle = document.querySelector('h1, div.ant-typography-h1, .problem-title, .css-1ydn1gj');
            if (problemTitle && !document.getElementById('doubtButton')) {
                addDoubtButton();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    setupCopyButtons();
    observeProblemChanges();
})();
