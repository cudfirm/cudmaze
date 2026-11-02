// reglog.js

document.addEventListener('DOMContentLoaded', function() {

    // --- Elements ---
    const backdrop = document.getElementById('modal-backdrop');
    const showInfoBtn = document.getElementById('see');

    // Info Modal Elements
    const infoModal = document.getElementById('info-modal');
    const proceedBtn = document.getElementById('proceed-button');

    // Confirmation Modal Elements
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmationForm = document.getElementById('confirmationForm');
    
    // Universal Close Buttons
    const closeButtons = document.querySelectorAll('.close-modal');

    // --- Modal Logic ---
    function showModal(modal) {
        backdrop.classList.add('visible');
        modal.classList.add('visible');
    }

    function hideAllModals() {
        backdrop.classList.remove('visible');
        infoModal.classList.remove('visible');
        confirmationModal.classList.remove('visible');
    }
    
    // Event Listeners
    showInfoBtn.addEventListener('click', () => showModal(infoModal));

    proceedBtn.addEventListener('click', () => {
        infoModal.classList.remove('visible');
        showModal(confirmationModal);
    });
    
    closeButtons.forEach(btn => {
        btn.addEventListener('click', hideAllModals);
    });

    backdrop.addEventListener('click', hideAllModals);

    // --- Form Validation Logic ---
    const username = document.getElementById('username');
    const password = document.getElementById('password');
    
    // Using simple validation since it's a confirmation/login
    function validate(input) {
        if (input.value.trim() !== '') {
            input.classList.remove('is-invalid');
            return true;
        } else {
            input.classList.add('is-invalid');
            return false;
        }
    }
    
    // Real-time validation listeners
    username.addEventListener('input', () => validate(username));
    password.addEventListener('input', () => validate(password));

    // Form submission handler
    confirmationForm.addEventListener('submit', function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const isUsernameValid = validate(username);
        const isPasswordValid = validate(password);

        confirmationForm.classList.add('was-validated');

        if (isUsernameValid && isPasswordValid) {
            alert('Confirmation Successful!');
            // Here you would send data to a server
            hideAllModals();
            confirmationForm.reset();
            confirmationForm.classList.remove('was-validated');
        } else {
            console.log('Confirmation form is invalid.');
        }
    });
});
