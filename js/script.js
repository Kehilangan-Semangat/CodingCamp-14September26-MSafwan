// ===== STATE MANAGEMENT =====
let transactions = [];
let categories = ['Food', 'Transport', 'Fun'];
let chartInstance = null;
let currentTheme = 'light';

// ===== DOM ELEMENTS =====
const elements = {
    form: document.getElementById('transactionForm'),
    itemName: document.getElementById('itemName'),
    amount: document.getElementById('amount'),
    category: document.getElementById('category'),
    transactionList: document.getElementById('transactionList'),
    totalBalance: document.getElementById('totalBalance'),
    themeToggle: document.getElementById('themeToggle'),
    themeIcon: document.querySelector('.theme-icon'),
    sortBy: document.getElementById('sortBy'),
    chartCanvas: document.getElementById('expenseChart'),
    chartMessage: document.getElementById('chartMessage'),
    addCategoryBtn: document.getElementById('addCategoryBtn'),
    categoryModal: document.getElementById('categoryModal'),
    customCategoryInput: document.getElementById('customCategoryInput'),
    saveCategoryBtn: document.getElementById('saveCategoryBtn'),
    cancelCategoryBtn: document.getElementById('cancelCategoryBtn')
};

// ===== INITIALIZATION =====
function init() {
    loadFromLocalStorage();
    setupEventListeners();
    renderTransactions();
    updateTotalBalance();
    updateChart();
    loadTheme();
}

// ===== LOCAL STORAGE FUNCTIONS =====
function saveToLocalStorage() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    localStorage.setItem('categories', JSON.stringify(categories));
}

function loadFromLocalStorage() {
    const storedTransactions = localStorage.getItem('transactions');
    const storedCategories = localStorage.getItem('categories');
    
    if (storedTransactions) {
        transactions = JSON.parse(storedTransactions);
    }
    
    if (storedCategories) {
        categories = JSON.parse(storedCategories);
        updateCategoryDropdown();
    }
}

function saveTheme(theme) {
    localStorage.setItem('theme', theme);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    currentTheme = savedTheme;
    applyTheme(savedTheme);
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    elements.form.addEventListener('submit', handleFormSubmit);
    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.sortBy.addEventListener('change', handleSort);
    elements.addCategoryBtn.addEventListener('click', openCategoryModal);
    elements.saveCategoryBtn.addEventListener('click', saveCustomCategory);
    elements.cancelCategoryBtn.addEventListener('click', closeCategoryModal);
    elements.categoryModal.addEventListener('click', handleModalClick);
    elements.customCategoryInput.addEventListener('keypress', handleCategoryKeyPress);
}

// ===== FORM HANDLING =====
function handleFormSubmit(e) {
    e.preventDefault();
    
    const itemName = elements.itemName.value.trim();
    const amount = parseFloat(elements.amount.value);
    const category = elements.category.value;
    
    // Validation
    if (!itemName) {
        showError('Please enter an item name');
        return;
    }
    
    if (!amount || amount <= 0) {
        showError('Please enter a valid positive amount');
        return;
    }
    
    if (!category) {
        showError('Please select a category');
        return;
    }
    
    // Create transaction object
    const transaction = {
        id: generateId(),
        itemName,
        amount,
        category,
        timestamp: Date.now()
    };
    
    // Add to transactions array
    transactions.push(transaction);
    
    // Save to local storage
    saveToLocalStorage();
    
    // Update UI
    renderTransactions();
    updateTotalBalance();
    updateChart();
    
    // Reset form
    elements.form.reset();
    elements.itemName.focus();
    
    // Show success feedback
    showSuccess('Transaction added successfully!');
}

// ===== TRANSACTION RENDERING =====
function renderTransactions() {
    const sortedTransactions = getSortedTransactions();
    
    if (sortedTransactions.length === 0) {
        elements.transactionList.innerHTML = '<p class="empty-message">No transactions yet. Start by adding one above!</p>';
        return;
    }
    
    elements.transactionList.innerHTML = sortedTransactions
        .map(transaction => createTransactionHTML(transaction))
        .join('');
    
    // Add delete event listeners
    document.querySelectorAll('.btn-danger').forEach(btn => {
        btn.addEventListener('click', () => deleteTransaction(btn.dataset.id));
    });
}

function createTransactionHTML(transaction) {
    return `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-name">${escapeHtml(transaction.itemName)}</div>
                <span class="transaction-category">${escapeHtml(transaction.category)}</span>
            </div>
            <span class="transaction-amount">-$${transaction.amount.toFixed(2)}</span>
            <button class="btn btn-danger" data-id="${transaction.id}">Delete</button>
        </div>
    `;
}

// ===== DELETE TRANSACTION =====
function deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) {
        return;
    }
    
    transactions = transactions.filter(t => t.id !== id);
    saveToLocalStorage();
    renderTransactions();
    updateTotalBalance();
    updateChart();
    showSuccess('Transaction deleted successfully!');
}

// ===== BALANCE CALCULATION =====
function updateTotalBalance() {
    const total = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    elements.totalBalance.textContent = `$${total.toFixed(2)}`;
}

// ===== SORTING =====
function handleSort() {
    renderTransactions();
}

function getSortedTransactions() {
    const sortValue = elements.sortBy.value;
    const transactionsCopy = [...transactions];
    
    switch (sortValue) {
        case 'amount-desc':
            return transactionsCopy.sort((a, b) => b.amount - a.amount);
        case 'amount-asc':
            return transactionsCopy.sort((a, b) => a.amount - b.amount);
        case 'category':
            return transactionsCopy.sort((a, b) => a.category.localeCompare(b.category));
        case 'date':
        default:
            return transactionsCopy.sort((a, b) => b.timestamp - a.timestamp);
    }
}

// ===== CHART RENDERING =====
function updateChart() {
    if (transactions.length === 0) {
        elements.chartMessage.classList.remove('hidden');
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        return;
    }
    
    elements.chartMessage.classList.add('hidden');
    
    // Calculate category totals
    const categoryTotals = {};
    transactions.forEach(transaction => {
        if (categoryTotals[transaction.category]) {
            categoryTotals[transaction.category] += transaction.amount;
        } else {
            categoryTotals[transaction.category] = transaction.amount;
        }
    });
    
    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    const colors = generateColors(labels.length);
    
    // Destroy existing chart
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    // Create new chart
    const ctx = elements.chartCanvas.getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: getComputedStyle(document.documentElement)
                    .getPropertyValue('--bg-secondary').trim()
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto'
                        },
                        color: getComputedStyle(document.documentElement)
                            .getPropertyValue('--text-primary').trim()
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: $${value.toFixed(2)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// ===== THEME TOGGLE =====
function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(currentTheme);
    saveTheme(currentTheme);
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        elements.themeIcon.textContent = '☀️';
    } else {
        document.documentElement.removeAttribute('data-theme');
        elements.themeIcon.textContent = '🌙';
    }
    
    // Update chart if it exists
    if (chartInstance) {
        updateChart();
    }
}

// ===== CUSTOM CATEGORY FUNCTIONS =====
function openCategoryModal() {
    elements.categoryModal.classList.add('active');
    elements.customCategoryInput.value = '';
    elements.customCategoryInput.focus();
}

function closeCategoryModal() {
    elements.categoryModal.classList.remove('active');
}

function handleModalClick(e) {
    if (e.target === elements.categoryModal) {
        closeCategoryModal();
    }
}

function handleCategoryKeyPress(e) {
    if (e.key === 'Enter') {
        saveCustomCategory();
    } else if (e.key === 'Escape') {
        closeCategoryModal();
    }
}

function saveCustomCategory() {
    const categoryName = elements.customCategoryInput.value.trim();
    
    if (!categoryName) {
        showError('Please enter a category name');
        return;
    }
    
    if (categories.includes(categoryName)) {
        showError('This category already exists');
        return;
    }
    
    if (categoryName.length > 20) {
        showError('Category name is too long (max 20 characters)');
        return;
    }
    
    categories.push(categoryName);
    updateCategoryDropdown();
    saveToLocalStorage();
    closeCategoryModal();
    
    // Select the new category
    elements.category.value = categoryName;
    
    showSuccess(`Category "${categoryName}" added successfully!`);
}

function updateCategoryDropdown() {
    const currentValue = elements.category.value;
    elements.category.innerHTML = categories
        .map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
        .join('');
    
    // Restore selection if it still exists
    if (categories.includes(currentValue)) {
        elements.category.value = currentValue;
    }
}

// ===== UTILITY FUNCTIONS =====
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function generateColors(count) {
    const baseColors = [
        '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6',
        '#ef4444', '#06b6d4', '#f97316', '#14b8a6', '#a855f7'
    ];
    
    const colors = [];
    for (let i = 0; i < count; i++) {
        colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    alert('❌ ' + message);
}

function showSuccess(message) {
    // Create a temporary success message element
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--success-color);
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        font-weight: 600;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        animation: fadeIn 0.3s ease;
    `;
    successDiv.textContent = '✅ ' + message;
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.style.opacity = '0';
        successDiv.style.transition = 'opacity 0.3s ease';
        setTimeout(() => successDiv.remove(), 300);
    }, 2000);
}

// ===== INITIALIZE APP =====
// Wait for Chart.js to load
if (typeof Chart !== 'undefined') {
    init();
} else {
    window.addEventListener('load', init);
}
