/**
 * Kid-Friendly Word Learning Website - Main JavaScript
 * Handles word display, pronunciation, word games, and filtering
 */

class WordLearningApp {
    constructor() {
        this.words = [];
        this.filteredWords = [];
        this.currentWord = null;
        this.language = 'english'; // Default language
        this.currentFilter = 'all';
        this.clickedWords = []; // Track last 10 clicked words
        this.wordLookup = new Map(); // Fast lookup by word text
        // Cached DOM references (populated after DOMContentLoaded / setup)
        this.dom = {
            wordsGrid: null,
            currentWord: null,
            currentPhonics: null
        };
        
        // Speech synthesis setup
        this.synth = window.speechSynthesis;
        this.voices = [];
        
        // Initialize the app
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Load voices when they're ready
            this.loadVoices();
            this.synth.onvoiceschanged = () => this.loadVoices();
            
            // Determine current page and language
            this.detectLanguage();
            
            // Load words based on current page
            if (this.isWordPage()) {
                await this.loadWords();
                this.setupWordPage();
            }
            
            // Setup event listeners
            this.setupEventListeners();
            
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showError('Failed to initialize the app. Please refresh the page.');
            
            // Clear loading state even on error
            const wordsGrid = document.getElementById('words-grid');
            if (wordsGrid) {
                wordsGrid.innerHTML = '<p class="no-words">Failed to load words. Please refresh the page.</p>';
            }
        }
    }

    /**
     * Detect current language based on page URL
     */
    detectLanguage() {
        const path = window.location.pathname;
        if (path.includes('french.html')) {
            this.language = 'french';
        } else if (path.includes('english.html')) {
            this.language = 'english';
        }
    }

    /**
     * Check if current page is a word learning page
     */
    isWordPage() {
        const path = window.location.pathname;
        return path.includes('english.html') || path.includes('french.html');
    }

    /**
     * Load speech synthesis voices
     */
    loadVoices() {
        this.voices = this.synth.getVoices();
    }

    /**
     * Get appropriate voice for current language
     */
    getVoice() {
        if (!this.voices || this.voices.length === 0) return null;
        if (this.language === 'french') {
            return this.voices.find(v => v.lang.includes('fr-CA') || v.lang.includes('fr-FR') || v.lang.includes('fr')) || this.voices[0];
        }
        return this.voices.find(v => v.lang.includes('en-CA') || v.lang.includes('en-US') || v.lang.includes('en')) || this.voices[0];
    }

    /**
     * Load words from JSON file
     */
    async loadWords() {
        try {
            const fileName = this.language === 'french' ? 'french-words.json' : 'english-words.json';
            
            const response = await fetch(`data/${fileName}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load words: ${response.status} ${response.statusText}`);
            }
            
            this.words = await response.json();
            this.filteredWords = [...this.words];
            // Build lookup map
            this.wordLookup.clear();
            this.words.forEach(w => { if (w && w.word) this.wordLookup.set(w.word, w); });
            
            // Ensure words are valid
            if (!Array.isArray(this.words) || this.words.length === 0) {
                throw new Error('No valid words found in data file');
            }
            
        } catch (error) {
            console.error('Error loading words:', error);
            this.words = [];
            this.filteredWords = [];
            this.showError(`Failed to load words: ${error.message}`);
        }
    }

    /**
     * Setup word page functionality
     */
    setupWordPage() {
        this.renderWords();
        // Cache DOM references post-render
        this.dom.wordsGrid = document.getElementById('words-grid');
        this.dom.currentWord = document.querySelector('.current-word');
        this.dom.currentPhonics = document.querySelector('.current-phonics');
        this.updateCurrentWordDisplay();
        this.setupFilterOptions();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Search functionality
        const searchBar = document.getElementById('search-bar');
        if (searchBar) {
            searchBar.addEventListener('input', (e) => {
                this.searchWords(e.target.value);
            });
        }

        // Filter functionality
        const filterSelect = document.getElementById('filter-select');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.filterWords(e.target.value);
            });
        }

        // Control buttons
        const randomBtn = document.getElementById('random-words-btn');
        if (randomBtn) {
            randomBtn.addEventListener('click', () => this.showRandomWords());
        }

        const historyBtn = document.getElementById('history-btn');
        if (historyBtn) {
            historyBtn.addEventListener('click', () => this.showLastClickedWords());
        }

        const showAllBtn = document.getElementById('show-all-btn');
        if (showAllBtn) {
            showAllBtn.addEventListener('click', () => this.showAllWords());
        }

        // Floating game button
        const floatingGameBtn = document.getElementById('floating-game-btn');
        if (floatingGameBtn) {
            floatingGameBtn.addEventListener('click', () => this.startWordGame());
        }

        // Delegate clicks for word buttons (performance improvement)
        const wordsGrid = document.getElementById('words-grid');
        if (wordsGrid) {
            wordsGrid.addEventListener('click', (e) => {
                const btn = e.target.closest('.word-btn');
                if (!btn) return;
                const wordText = btn.dataset.word;
                const wordObj = this.wordLookup.get(wordText);
                if (wordObj) this.onWordButtonSelected(btn, wordObj);
            });
        }

        // Current word display click to repeat
        const currentWordDisplay = this.dom.currentWord || document.querySelector('.current-word');
        if (currentWordDisplay) {
            currentWordDisplay.addEventListener('click', () => {
                if (this.currentWord) {
                    this.speakWord(this.currentWord);
                }
            });
            currentWordDisplay.style.cursor = 'pointer';
            currentWordDisplay.title = 'Click to repeat pronunciation';
            // Add accessibility attributes
            currentWordDisplay.setAttribute('role', 'button');
            currentWordDisplay.setAttribute('tabindex', '0');
            currentWordDisplay.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (this.currentWord) {
                        this.speakWord(this.currentWord);
                    }
                }
            });
        }

        // Setup sticky scroll behavior
        this.setupSimpleStickyBehavior();
    }

    /**
     * Setup sticky behavior only for Words Collection section
     */
    setupSimpleStickyBehavior() {
        const currentWordDisplay = document.querySelector('.current-word-display');
        const wordsContainer = document.querySelector('.words-container');
        
        if (!currentWordDisplay || !wordsContainer) return;

        const handleScroll = () => {
            const wordsContainerRect = wordsContainer.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            
            // Check if we're scrolling through the words container
            const isInWordsSection = (
                wordsContainerRect.top <= 80 && // Words section has started
                wordsContainerRect.bottom > 120   // Words section hasn't ended
            );
            
            if (isInWordsSection) {
                // Show and activate sticky only when in words section
                currentWordDisplay.style.display = 'block';
                currentWordDisplay.classList.add('sticky-active');
                // Add some top padding to words container to prevent overlap
                wordsContainer.style.paddingTop = '80px';
            } else {
                // Hide and deactivate sticky when outside words section
                currentWordDisplay.style.display = 'none';
                currentWordDisplay.classList.remove('sticky-active');
                // Remove extra padding
                wordsContainer.style.paddingTop = '1.5rem';
            }
        };

        // Use optimized scroll handling
        let scrollTimer = null;
        window.addEventListener('scroll', () => {
            if (scrollTimer) clearTimeout(scrollTimer);
            scrollTimer = setTimeout(handleScroll, 10);
        }, { passive: true });

        // Initial check
        handleScroll();
    }

    /**
     * Setup filter options in dropdown
     */
    setupFilterOptions() {
        const filterSelect = document.getElementById('filter-select');
        if (!filterSelect) return;

        const categories = this.getUniqueCategories();
        filterSelect.innerHTML = '<option value="all">All Words</option>';
        
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = this.formatCategoryName(category);
            filterSelect.appendChild(option);
        });
    }

    /**
     * Get unique categories from words
     */
    getUniqueCategories() {
        const categories = new Set();
        this.words.forEach(word => {
            categories.add(word.category);
        });
        return Array.from(categories).sort();
    }

    /**
     * Format category name for display
     */
    formatCategoryName(category) {
        const categoryNames = {
            'simple': 'Simple Words',
            'digraph': 'Digraphs (sh, ch, th, ph, wh)',
            'trigraph': 'Trigraphs (tch, igh, dge)',
            'blend': 'Blends/Consonant Clusters',
            'vowel_team': 'Vowel Teams (ea, oa, ai, ee)',
            'diphthong': 'Diphthongs (oi, oy, ow, ou)',
            'silent': 'Silent Letters',
            'magic_e': 'Magic E (hop → hope)',
            'r_controlled': 'R-controlled Vowels',
            'double': 'Double Consonants',
            'schwa': 'Schwa Sound',
            'special': 'Special Characters'
        };
        return categoryNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
    }

    /**
     * Search words based on input
     */
    searchWords(searchTerm) {
        if (!searchTerm.trim()) {
            this.filteredWords = this.currentFilter === 'all' ? 
                [...this.words] : 
                this.words.filter(word => word.category === this.currentFilter);
        } else {
            const term = searchTerm.toLowerCase();
            const baseWords = this.currentFilter === 'all' ? 
                this.words : 
                this.words.filter(word => word.category === this.currentFilter);
            
            this.filteredWords = baseWords.filter(word => 
                word.word.toLowerCase().includes(term) ||
                word.phonics.toLowerCase().includes(term)
            );
        }
        this.renderWords();
    }

    /**
     * Filter words by category
     */
    filterWords(category) {
        this.currentFilter = category;
        const searchTerm = document.getElementById('search-bar')?.value || '';
        
        if (category === 'all') {
            this.filteredWords = [...this.words];
        } else {
            this.filteredWords = this.words.filter(word => word.category === category);
        }

        // Apply search filter if there's a search term
        if (searchTerm.trim()) {
            this.searchWords(searchTerm);
        } else {
            this.renderWords();
        }
    }

    /**
     * Render words in the grid
     */
    renderWords() {
        const wordsGrid = this.dom.wordsGrid || document.getElementById('words-grid');
        if (!wordsGrid) {
            console.error('Words grid element not found');
            return;
        }
        
        if (!this.filteredWords || this.filteredWords.length === 0) {
            wordsGrid.innerHTML = '<p class="no-words">No words found matching your criteria.</p>';
            return;
        }

        // Clear loading state
        wordsGrid.innerHTML = '';
        
        // Build document fragment for efficiency
        const frag = document.createDocumentFragment();
        this.filteredWords.forEach(wordObj => {
            const wordBtn = this.createWordButton(wordObj);
            frag.appendChild(wordBtn);
        });
        wordsGrid.appendChild(frag);
    }

    /**
     * Create a word button element
     */
    createWordButton(wordObj) {
        if (!wordObj || !wordObj.word) {
            console.error('Invalid word object:', wordObj);
            return document.createElement('div'); // Return empty div to prevent errors
        }
        
        const button = document.createElement('button');
        button.className = 'word-btn';
        button.textContent = wordObj.word;
        button.dataset.word = wordObj.word;
        
        // Add clicked class if this is the current word
        if (this.currentWord && this.currentWord.word === wordObj.word) {
            button.classList.add('clicked');
        }

        return button;
    }

    /**
     * Handle delegated word button selection without full re-render
     */
    onWordButtonSelected(buttonEl, wordObj) {
        // Update previous clicked button class
        if (this.currentWord && this.currentWord.word !== wordObj.word) {
            const prev = document.querySelector('.word-btn.clicked');
            if (prev) prev.classList.remove('clicked');
        }
        // Set new current word
        this.currentWord = wordObj;
        buttonEl.classList.add('clicked');
        this.updateCurrentWordDisplay();
        this.speakWord(wordObj);
        this.addToClickedWords(wordObj.word);
        // Bounce animation
        if (this.dom.currentWord) {
            this.dom.currentWord.classList.remove('bounce');
            setTimeout(() => this.dom.currentWord && this.dom.currentWord.classList.add('bounce'), 10);
        }
    }

    /**
     * Speak a word using Web Speech API
     */
    speakWord(wordObj) {
        if (!this.synth) {
            console.warn('Speech synthesis not supported');
            return;
        }

        // Cancel any ongoing speech
        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(wordObj.word);
        const voice = this.getVoice();
        
        if (voice) {
            utterance.voice = voice;
        }
        
        // Set language-specific properties
        utterance.lang = this.language === 'french' ? 'fr-FR' : 'en-US';
        utterance.rate = 0.8; // Slightly slower for learning
        utterance.pitch = 1.1; // Slightly higher pitch for friendliness
        utterance.volume = 1;

        // Add error handling
        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event.error);
        };

        utterance.onend = () => {
            // Speech finished
        };

        this.synth.speak(utterance);
    }

    /**
     * Update current word display
     */
    updateCurrentWordDisplay() {
    const currentWordElement = this.dom.currentWord || document.querySelector('.current-word');
    const currentPhonicsElement = this.dom.currentPhonics || document.querySelector('.current-phonics');
        
        if (this.currentWord) {
            if (currentWordElement) {
                currentWordElement.textContent = this.currentWord.word;
            }
            if (currentPhonicsElement) {
                currentPhonicsElement.textContent = `(${this.currentWord.phonics})`;
            }
        } else {
            if (currentWordElement) {
                currentWordElement.textContent = 'Click a word to hear it!';
            }
            if (currentPhonicsElement) {
                currentPhonicsElement.textContent = '';
            }
        }
    }

    /**
     * Add word to clicked words list (for last 10 functionality)
     */
    addToClickedWords(word) {
        // Remove if already in list
        const index = this.clickedWords.indexOf(word);
        if (index > -1) {
            this.clickedWords.splice(index, 1);
        }
        
        // Add to beginning
        this.clickedWords.unshift(word);
        
        // Keep only last 10
        this.clickedWords = this.clickedWords.slice(0, 10);
    }

    /**
     * Show random words
     */
    showRandomWords() {
        const randomWords = this.getRandomWords(10);
        this.filteredWords = randomWords;
        this.renderWords();
        
        // Clear search and filter
        const searchBar = document.getElementById('search-bar');
        const filterSelect = document.getElementById('filter-select');
        if (searchBar) searchBar.value = '';
        if (filterSelect) filterSelect.value = 'all';
        
        this.showToast('Showing 10 random words!');
    }

    /**
     * Get random words from the collection
     */
    getRandomWords(count) {
        const shuffled = [...this.words].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    /**
     * Show last 10 clicked words
     */
    showLastClickedWords() {
        if (this.clickedWords.length === 0) {
            this.showToast('No clicked words yet!');
            return;
        }
        
        const clickedWordObjects = this.clickedWords.map(word => 
            this.words.find(w => w.word === word)
        ).filter(Boolean);
        
        this.filteredWords = clickedWordObjects;
        this.renderWords();
        
        // Clear search and filter
        const searchBar = document.getElementById('search-bar');
        const filterSelect = document.getElementById('filter-select');
        if (searchBar) searchBar.value = '';
        if (filterSelect) filterSelect.value = 'all';
        
        this.showToast(`Showing your last ${clickedWordObjects.length} clicked words!`);
    }

    /**
     * Show all words (reset to full collection)
     */
    showAllWords() {
        // Reset to all words
        this.filteredWords = [...this.words];
        this.renderWords();
        
        // Clear search and reset filter
        const searchBar = document.getElementById('search-bar');
        const filterSelect = document.getElementById('filter-select');
        if (searchBar) searchBar.value = '';
        if (filterSelect) filterSelect.value = 'all';
        this.currentFilter = 'all';
        
        this.showToast(`Showing all ${this.words.length} words!`);
    }

    /**
     * Start the word game
     */
    startWordGame() {
        // Guard: prevent starting a new game if one is already active
        const modal = document.getElementById('game-modal');
        if (this.gameState && modal && modal.style.display === 'flex') {
            return; // Game already running
        }
        this.initializeGame();
        this.showGameModal();
        this.startNewGameRound();
    }

    /**
     * Initialize game state
     */
    initializeGame() {
        this.gameState = {
            currentQuestion: 0,
            score: 0,
            totalQuestions: 10,
            timeLeft: 10,
            timer: null,
            gameWords: [],
            currentWord: null,
            correctAnswer: '',
            isAnswered: false
        };

        // Create Web Audio context for sounds
        this.initializeAudio();
        
        // Select 10 words: 5 easy, 5 hard
        this.selectGameWords();
    }

    /**
     * Initialize Web Audio for game sounds
     */
    initializeAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            this.audioContext = null;
        }
    }

    /**
     * Select words for the game (5 easy + 5 hard)
     */
    selectGameWords() {
        const easyWords = this.words.filter(word => 
            word.category === 'simple' && word.word.length <= 3
        );
        const hardWords = this.words.filter(word => 
            ['digraph', 'blend', 'trigraph', 'vowel_team'].includes(word.category)
        );

        // Shuffle and select
        const selectedEasy = this.shuffleArray([...easyWords]).slice(0, 5);
        const selectedHard = this.shuffleArray([...hardWords]).slice(0, 5);
        
        this.gameState.gameWords = [...selectedEasy, ...selectedHard];
        this.gameState.gameWords = this.shuffleArray(this.gameState.gameWords);
    }

    /**
     * Shuffle array utility
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Show game modal
     */
    showGameModal() {
        const modal = document.getElementById('game-modal');
        if (modal) {
            modal.style.display = 'flex';
            this.setupGameEventListeners();
            // Accessibility: focus management
            this.previousFocus = document.activeElement;
            const container = modal.querySelector('.game-container');
            if (container) {
                container.setAttribute('tabindex', '-1');
                container.focus();
            }
            this.enableFocusTrap();
        }
    }

    /**
     * Setup game event listeners
     */
    setupGameEventListeners() {
        // Close button
        const closeBtn = document.getElementById('close-game');
        if (closeBtn) {
            closeBtn.onclick = () => this.closeGame();
            closeBtn.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.closeGame(); } };
        }

        // Listen again button
        const listenBtn = document.getElementById('listen-again-btn');
        if (listenBtn) {
            listenBtn.onclick = () => this.speakCurrentGameWord();
        }

        // Letter option buttons
        const letterOptions = document.querySelectorAll('.letter-option');
        letterOptions.forEach(btn => {
            btn.onclick = () => this.selectLetter(btn.dataset.letter);
            btn.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.selectLetter(btn.dataset.letter); } };
        });

        // Play again button
        const playAgainBtn = document.getElementById('play-again-btn');
        if (playAgainBtn) {
            playAgainBtn.onclick = () => this.startWordGame();
            playAgainBtn.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.startWordGame(); } };
        }

        // Close results button
        const closeResultsBtn = document.getElementById('close-results-btn');
        if (closeResultsBtn) {
            closeResultsBtn.onclick = () => this.closeGame();
            closeResultsBtn.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.closeGame(); } };
        }
    }

    /**
     * Start a new game round
     */
    startNewGameRound() {
        if (this.gameState.currentQuestion >= this.gameState.totalQuestions) {
            this.endGame();
            return;
        }

        this.gameState.currentWord = this.gameState.gameWords[this.gameState.currentQuestion];
        this.gameState.isAnswered = false;
        this.gameState.timeLeft = 10;

        this.generateWordPuzzle();
        this.updateGameUI();
        this.startTimer();
        this.speakCurrentGameWord();
    }

    /**
     * Generate word puzzle with missing letters
     */
    generateWordPuzzle() {
        const word = this.gameState.currentWord.word.toUpperCase();
        let missingPart = '';
        let displayWord = '';

        // Smart missing letter logic based on word category
        if (word.length <= 3) {
            // For 3-letter words, remove middle or last letter
            const position = Math.random() > 0.5 ? 1 : 2;
            missingPart = word[position];
            displayWord = word.substring(0, position) + '_' + word.substring(position + 1);
        } else {
            // For longer words, try to remove digraphs/blends
            const digraphs = ['SH', 'CH', 'TH', 'PH', 'WH'];
            const blends = ['ST', 'SP', 'SK', 'SM', 'SN', 'SL', 'SW', 'SC'];
            
            let found = false;
            
            // Check for digraphs first
            for (const digraph of digraphs) {
                const index = word.indexOf(digraph);
                if (index !== -1) {
                    missingPart = digraph;
                    displayWord = word.substring(0, index) + '_'.repeat(digraph.length) + word.substring(index + digraph.length);
                    found = true;
                    break;
                }
            }
            
            // If no digraph found, check for blends
            if (!found) {
                for (const blend of blends) {
                    const index = word.indexOf(blend);
                    if (index !== -1) {
                        missingPart = blend;
                        displayWord = word.substring(0, index) + '_'.repeat(blend.length) + word.substring(index + blend.length);
                        found = true;
                        break;
                    }
                }
            }
            
            // Fallback: remove random letter
            if (!found) {
                const position = Math.floor(Math.random() * word.length);
                missingPart = word[position];
                displayWord = word.substring(0, position) + '_' + word.substring(position + 1);
            }
        }

        this.gameState.correctAnswer = missingPart;
        this.gameState.displayWord = displayWord;
        this.generateLetterOptions(missingPart);
    }

    /**
     * Generate 4 letter options (1 correct + 3 wrong)
     */
    generateLetterOptions(correctAnswer) {
        const options = [correctAnswer];
        
        // Generate similar wrong options
        const wrongOptions = this.generateSimilarLetters(correctAnswer);
        
        // Add 3 wrong options
        while (options.length < 4 && wrongOptions.length > 0) {
            const randomWrong = wrongOptions.splice(Math.floor(Math.random() * wrongOptions.length), 1)[0];
            if (!options.includes(randomWrong)) {
                options.push(randomWrong);
            }
        }
        
        // Fill remaining slots if needed
        while (options.length < 4) {
            const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
            if (!options.includes(randomLetter)) {
                options.push(randomLetter);
            }
        }
        
        this.gameState.letterOptions = this.shuffleArray(options);
    }

    /**
     * Generate similar letters for wrong options
     */
    generateSimilarLetters(correctAnswer) {
        const similar = {
            'A': ['E', 'I', 'O'],
            'B': ['D', 'P', 'R'],
            'C': ['G', 'O', 'Q'],
            'D': ['B', 'O', 'P'],
            'E': ['A', 'F', 'I'],
            'F': ['E', 'P', 'T'],
            'G': ['C', 'O', 'Q'],
            'H': ['N', 'R', 'K'],
            'I': ['A', 'E', 'L'],
            'J': ['I', 'L', 'T'],
            'K': ['H', 'R', 'X'],
            'L': ['I', 'J', 'T'],
            'M': ['N', 'H', 'W'],
            'N': ['M', 'H', 'R'],
            'O': ['C', 'G', 'Q'],
            'P': ['B', 'D', 'F'],
            'Q': ['C', 'G', 'O'],
            'R': ['B', 'H', 'K'],
            'S': ['C', 'G', 'Z'],
            'T': ['F', 'J', 'L'],
            'U': ['V', 'W', 'Y'],
            'V': ['U', 'W', 'Y'],
            'W': ['M', 'U', 'V'],
            'X': ['K', 'Y', 'Z'],
            'Y': ['U', 'V', 'X'],
            'Z': ['S', 'X', 'Y'],
            // Digraphs
            'SH': ['CH', 'TH', 'PH'],
            'CH': ['SH', 'TH', 'PH'],
            'TH': ['SH', 'CH', 'PH'],
            'PH': ['SH', 'CH', 'TH'],
            'WH': ['SH', 'CH', 'TH'],
            'ST': ['SP', 'SK', 'SM'],
            'SP': ['ST', 'SK', 'SM'],
            'SK': ['ST', 'SP', 'SM'],
            'SM': ['ST', 'SP', 'SK']
        };
        
        return similar[correctAnswer] || ['X', 'Y', 'Z'];
    }

    /**
     * Update game UI
     */
    updateGameUI() {
        // Update score
        document.getElementById('game-score').textContent = 
            `${this.gameState.score}/${this.gameState.totalQuestions}`;
        
        // Update timer
        document.getElementById('game-timer').textContent = this.gameState.timeLeft;
        
        // Update word display
        document.getElementById('game-word').textContent = this.gameState.displayWord;
        
        // Update letter options
        const letterButtons = document.querySelectorAll('.letter-option');
        letterButtons.forEach((btn, index) => {
            btn.textContent = this.gameState.letterOptions[index];
            btn.dataset.letter = this.gameState.letterOptions[index];
            btn.className = 'letter-option'; // Reset classes
            btn.disabled = false;
        });
        
        // Clear feedback
        document.getElementById('game-feedback').innerHTML = '';
        
        // Hide results, show game content
        document.getElementById('game-results').style.display = 'none';
        document.querySelector('.game-content').style.display = 'block';
    }

    /**
     * Start countdown timer
     */
    startTimer() {
        if (this.gameState.timer) {
            clearInterval(this.gameState.timer);
        }
        
        this.gameState.timer = setInterval(() => {
            this.gameState.timeLeft--;
            document.getElementById('game-timer').textContent = this.gameState.timeLeft;
            
            if (this.gameState.timeLeft <= 0) {
                this.timeUp();
            }
        }, 1000);
    }

    /**
     * Handle time up
     */
    timeUp() {
        if (!this.gameState.isAnswered) {
            this.gameState.isAnswered = true;
            this.showFeedback(false, `Time's up! Correct answer: ${this.gameState.correctAnswer}`);
            setTimeout(() => this.nextQuestion(), 2000);
        }
    }

    /**
     * Speak current game word
     */
    speakCurrentGameWord() {
        if (this.gameState.currentWord) {
            this.speakWord(this.gameState.currentWord);
        }
    }

    /**
     * Handle letter selection
     */
    selectLetter(letter) {
        if (this.gameState.isAnswered) return;
        
        this.gameState.isAnswered = true;
        clearInterval(this.gameState.timer);
        
        const isCorrect = letter === this.gameState.correctAnswer;
        
        if (isCorrect) {
            this.gameState.score++; this.playSound('correct'); this.showFeedback(true, '🎉 Correct! Well done!');
        } else {
            this.playSound('wrong'); this.showFeedback(false, `😔 Wrong! Correct answer: ${this.gameState.correctAnswer}`);
        }
        
        const buttons = document.querySelectorAll('.letter-option');
        buttons.forEach(btn => {
            if (btn.dataset.letter === letter) btn.classList.add(isCorrect ? 'correct' : 'wrong');
            else if (btn.dataset.letter === this.gameState.correctAnswer) btn.classList.add('correct');
            btn.disabled = true;
        });
        
        setTimeout(() => this.nextQuestion(), 2500);
    }

    /**
     * Show feedback message
     */
    showFeedback(isCorrect, message) {
        const feedback = document.getElementById('game-feedback');
        feedback.innerHTML = message;
        feedback.className = `game-feedback ${isCorrect ? 'feedback-correct' : 'feedback-wrong'}`;
    }

    /**
     * Move to next question
     */
    nextQuestion() {
        this.gameState.currentQuestion++;
        this.startNewGameRound();
    }

    /**
     * Play game sounds
     */
    playSound(type) {
        if (!this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            if (type === 'correct') {
                // Happy ascending tone
                oscillator.frequency.setValueAtTime(523.25, this.audioContext.currentTime); // C5
                oscillator.frequency.setValueAtTime(659.25, this.audioContext.currentTime + 0.1); // E5
                oscillator.frequency.setValueAtTime(783.99, this.audioContext.currentTime + 0.2); // G5
            } else {
                // Sad descending tone
                oscillator.frequency.setValueAtTime(392.00, this.audioContext.currentTime); // G4
                oscillator.frequency.setValueAtTime(329.63, this.audioContext.currentTime + 0.15); // E4
                oscillator.frequency.setValueAtTime(261.63, this.audioContext.currentTime + 0.3); // C4
            }
            
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.5);
        } catch (error) {
            // Sound playback failed silently
        }
    }

    /**
     * End game and show results
     */
    endGame() {
        clearInterval(this.gameState.timer);
        
        // Hide game content, show results
        document.querySelector('.game-content').style.display = 'none';
        document.getElementById('game-results').style.display = 'block';
        
        // Update final score
        document.getElementById('final-score').textContent = 
            `${this.gameState.score}/${this.gameState.totalQuestions}`;
        
        // Generate results message
        const percentage = (this.gameState.score / this.gameState.totalQuestions) * 100;
        let message = '';
        
        if (percentage >= 90) {
            message = '🌟 Outstanding! You\'re a word wizard!';
        } else if (percentage >= 70) {
            message = '🎉 Great job! Keep up the excellent work!';
        } else if (percentage >= 50) {
            message = '👍 Good effort! Practice makes perfect!';
        } else {
            message = '💪 Keep trying! You\'ll get better with practice!';
        }
        
        document.getElementById('results-message').textContent = message;
    }

    /**
     * Close game modal
     */
    closeGame() {
        const modal = document.getElementById('game-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        if (this.gameState && this.gameState.timer) {
            clearInterval(this.gameState.timer);
        }
        this.gameState = null;
        this.disableFocusTrap();
        if (this.previousFocus && typeof this.previousFocus.focus === 'function') {
            try { this.previousFocus.focus(); } catch(_) {}
        }
    }

    /**
     * Show toast notification
     */
    showToast(message) {
        // Remove existing toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        // Create new toast
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 1rem 2rem;
            border-radius: 25px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 1000;
            font-family: inherit;
            font-weight: bold;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s ease;
        `;

        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);

        // Remove after delay
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * Show error message
     */
    showError(message) {
        const toast = document.createElement('div');
        toast.className = 'toast error';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 1rem 2rem;
            border-radius: 25px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 1000;
            font-family: inherit;
            font-weight: bold;
        `;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 5000);
    }

    /**
     * Enable focus trap within the game modal
     */
    enableFocusTrap() {
        if (this.focusTrapHandler) return;
        this.focusTrapHandler = (e) => {
            const modal = document.getElementById('game-modal');
            if (!modal || modal.style.display !== 'flex') return;
            if (e.key === 'Escape') { e.preventDefault(); this.closeGame(); return; }
            if (e.key !== 'Tab') return;
            const selectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
            const focusable = Array.from(modal.querySelectorAll(selectors)).filter(el => !el.disabled && el.getAttribute('aria-hidden') !== 'true');
            if (!focusable.length) return;
            const first = focusable[0]; const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', this.focusTrapHandler, true);
    }

    /**
     * Disable focus trap
     */
    disableFocusTrap() {
        if (this.focusTrapHandler) { document.removeEventListener('keydown', this.focusTrapHandler, true); this.focusTrapHandler = null; }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.wordApp = new WordLearningApp();
});

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WordLearningApp;
}
