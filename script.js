let map;
let geocoder;
let midpointMarker;
let markerA;
let markerB;
let infoWindow;
// Store selected places
let selectedPlaceA = null;
let selectedPlaceB = null;
let tempSavedPlace = null; // Temporary storage for "Add Location" modal

const AuthService = {
    // Keys for localStorage
    USERS_KEY: 'midpoint_users',
    CURRENT_USER_KEY: 'midpoint_current_user',

    // Get all registered users
    getUsers() {
        const users = localStorage.getItem(this.USERS_KEY);
        return users ? JSON.parse(users) : {};
    },

    // Get currently logged in user
    getCurrentUser() {
        return localStorage.getItem(this.CURRENT_USER_KEY);
    },

    // Get user data by email
    getUser(email) {
        const users = this.getUsers();
        return users[email] || null;
    },

    // Save a meeting for the current user
    saveMeeting(meetingData) {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return { success: false, message: "Not logged in." };

        const users = this.getUsers();
        const user = users[currentUserEmail];

        if (!user.savedMeetings) {
            user.savedMeetings = [];
        }

        // Add timestamp
        meetingData.savedAt = new Date().toISOString();
        user.savedMeetings.push(meetingData);

        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        return { success: true };
    },

    // Get saved meetings
    getSavedMeetings() {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return [];
        const users = this.getUsers();
        return users[currentUserEmail].savedMeetings || [];
    },

    // Save Location (Home/Work)
    saveLocation(alias, address, place = null) {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return { success: false, message: "Not logged in." };

        const users = this.getUsers();
        const user = users[currentUserEmail];

        if (!user.locations) {
            user.locations = [];
        }

        // Remove existing with same alias if exists
        user.locations = user.locations.filter(l => l.alias !== alias);

        user.locations.push({ alias, address, place });

        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        return { success: true };
    },

    // Get Locations
    getLocations() {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return [];
        const users = this.getUsers();
        return (users[currentUserEmail] && users[currentUserEmail].locations) ? users[currentUserEmail].locations : [];
    },

    // Delete Location
    deleteLocation(alias) {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return;

        const users = this.getUsers();
        const user = users[currentUserEmail];
        if (!user.locations) return;

        user.locations = user.locations.filter(l => l.alias !== alias);
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    },

    // Reorder Location
    reorderLocation(fromIndex, toIndex) {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return;

        const users = this.getUsers();
        const user = users[currentUserEmail];
        if (!user.locations) return;

        // Remove from old index
        const [movedItem] = user.locations.splice(fromIndex, 1);

        // Insert at new index
        user.locations.splice(toIndex, 0, movedItem);

        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    },

    // Rename Location
    renameLocation(index, newAlias) {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return { success: false, message: "Not logged in" };

        const users = this.getUsers();
        const user = users[currentUserEmail];
        if (!user.locations) return { success: false, message: "No locations found" };

        if (index < 0 || index >= user.locations.length) return { success: false, message: "Invalid index" };

        // Check for duplicate alias (excluding self)
        const duplicate = user.locations.some((loc, i) => i !== index && loc.alias.toLowerCase() === newAlias.toLowerCase());
        if (duplicate) {
            return { success: false, message: "Location name already exists." };
        }

        user.locations[index].alias = newAlias;
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        return { success: true };
    },

    // Add to History (Auto-Log)
    addToHistory(entry) {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return;

        const users = this.getUsers();
        const user = users[currentUserEmail];

        if (!user.history) {
            user.history = [];
        }

        // Add to beginning
        user.history.unshift(entry);

        // Limit to 20
        if (user.history.length > 20) {
            user.history = user.history.slice(0, 20);
        }

        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    },

    // Get History
    getHistory() {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return [];
        const users = this.getUsers();
        return users[currentUserEmail].history || [];
    },

    // Save Preferences
    savePreferences(prefs) {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return { success: false, message: "Not logged in." };

        const users = this.getUsers();
        const user = users[currentUserEmail];

        // Safety check - ensure user exists
        if (!user) return { success: false, message: "User profile not found." };

        user.preferences = {
            defaultMode: prefs.defaultMode || '',
            defaultType: prefs.defaultType || '',
            defaultSort: prefs.defaultSort || '',
            defaultRating: prefs.defaultRating !== undefined ? prefs.defaultRating : 0
        };

        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        return { success: true };
    },

    // Get Preferences
    getPreferences() {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return null;
        const users = this.getUsers();
        const user = users[currentUserEmail];
        return user.preferences || null;
    },



    // Sign Up
    signUp(email, password, firstName, lastName) {
        const users = this.getUsers();
        if (users[email]) {
            return { success: false, message: "User already exists." };
        }
        users[email] = {
            password: password,
            firstName: firstName || '',
            lastName: lastName || ''
        };
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        this.login(email, password);
        return { success: true };
    },

    // Login
    login(email, password) {
        const users = this.getUsers();
        const user = users[email];
        if (user && user.password === password) {
            localStorage.setItem(this.CURRENT_USER_KEY, email);
            return { success: true };
        }
        return { success: false, message: "Invalid email or password." };
    },

    // Logout
    logout() {
        localStorage.removeItem(this.CURRENT_USER_KEY);
    },

    // Update Profile
    updateProfile(data) {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return { success: false, message: "Not logged in" };

        const users = this.getUsers();
        const user = users[currentUserEmail];

        // Update fields if provided
        if (data.firstName !== undefined) user.firstName = data.firstName;
        if (data.lastName !== undefined) user.lastName = data.lastName;
        if (data.city !== undefined) user.city = data.city;
        if (data.phone !== undefined) user.phone = data.phone;
        if (data.profilePic !== undefined) user.profilePic = data.profilePic;

        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        return { success: true };
    }
};

// Auth State
let isLoginMode = true;

// UI Helpers
function toggleAuthModal() {
    const modal = document.getElementById('authModal');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
    // Reset to login mode when opening
    if (modal.style.display === 'flex') {
        isLoginMode = true;
        updateModalText();
    }
}

function switchAuthMode() {
    isLoginMode = !isLoginMode;
    updateModalText();
}

function updateModalText() {
    document.getElementById('modalTitle').innerText = isLoginMode ? 'Login' : 'Sign Up';
    document.getElementById('nameFields').style.display = isLoginMode ? 'none' : 'block';
    document.getElementById('authToggleText').innerHTML = isLoginMode
        ? 'Need an account? <a href="#" onclick="switchAuthMode()">Sign Up</a>'
        : 'Already have an account? <a href="#" onclick="switchAuthMode()">Login</a>';
}

function handleAuth() {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const firstName = document.getElementById('authFirstName').value;
    const lastName = document.getElementById('authLastName').value;

    if (!email || !password) {
        showNotification("Please enter email and password");
        return;
    }

    // Check names if signing up
    if (!isLoginMode && (!firstName || !lastName)) {
        showNotification("Please enter your name.");
        return;
    }

    let result;
    if (isLoginMode) {
        result = AuthService.login(email, password);
    } else {
        result = AuthService.signUp(email, password, firstName, lastName);
    }

    if (result.success) {
        toggleAuthModal();
        updateAuthUI();
        // Clear form
        document.getElementById('authEmail').value = '';
        document.getElementById('authPassword').value = '';
    } else {
        showNotification(result.message);
    }
}

function logout() {
    AuthService.logout();
    updateAuthUI();
}

function updateAuthUI() {
    const currentUserEmail = AuthService.getCurrentUser();
    const loginBtn = document.getElementById('loginBtn');
    const userDisplay = document.getElementById('userDisplay');
    const welcomeMsg = document.getElementById('welcomeMsg');
    const startPointLabel = document.getElementById('startPointLabel');

    if (currentUserEmail) {
        // Try to get full user object to show name
        const userObj = AuthService.getUser(currentUserEmail);
        const displayName = (userObj && userObj.firstName) ? userObj.firstName : currentUserEmail;

        loginBtn.style.display = 'none';
        userDisplay.style.display = 'flex'; // Consistent with .nav-group
        welcomeMsg.style.display = 'inline';
        welcomeMsg.innerText = `Welcome, ${displayName}`;

        if (startPointLabel) {
            startPointLabel.innerText = (userObj && userObj.firstName) ? `${userObj.firstName}'s starting point` : 'your starting point';
        }

        // Show chips
        renderLocationChips();

        // Apply Preferences
        loadUserPreferences();
    } else {
        loginBtn.style.display = 'block';
        userDisplay.style.display = 'none';
        welcomeMsg.style.display = 'none';

        if (startPointLabel) {
            startPointLabel.innerText = 'your starting point';
        }

        // Clear Search Form & Results
        const addrA = document.getElementById('addressA');
        const addrB = document.getElementById('addressB');
        const type = document.getElementById('placeType');
        const chipsA = document.getElementById('chipsA');
        const chipsB = document.getElementById('chipsB');
        const results = document.getElementById('results');

        if (addrA) addrA.value = '';
        if (addrB) addrB.value = '';
        if (type) type.value = '';
        if (chipsA) chipsA.innerHTML = '';
        if (chipsB) chipsB.innerHTML = '';
        if (results) results.innerHTML = '';

        // Hide share button
        const shareBtn = document.getElementById('shareBtn');
        if (shareBtn) shareBtn.style.display = 'none';
    }
}

// Expose to window for HTML onClick handlers
window.toggleAuthModal = toggleAuthModal;
window.switchAuthMode = switchAuthMode;

// Profile & Locations Helpers
function toggleProfileModal() {
    const modal = document.getElementById('profileModal');
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
        isEditingProfile = false; // Reset state
    } else {
        const userEmail = AuthService.getCurrentUser();
        const user = AuthService.getUser(userEmail);
        if (user) {
            // Render My Info Section
            renderMyInfo();

            // Allow managing preferences (load current)
            loadUserPreferences();

            // Render Locations
            renderManageLocations();
        }
        modal.style.display = 'flex';
    }
}

// My Info State & Rendering
let isEditingProfile = false;

function renderMyInfo() {
    const container = document.getElementById('myInfoContainer');
    const userEmail = AuthService.getCurrentUser();
    const user = AuthService.getUser(userEmail);
    if (!user) return;

    const sectionStyle = "margin-bottom: 30px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 20px;";

    if (!isEditingProfile) {
        // View Mode
        const picHtml = user.profilePic
            ? `<img src="${user.profilePic}" class="profile-pic" style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; box-shadow: var(--shadow-sm);">`
            : `<div style="width: 70px; height: 70px; border-radius: 50%; background: var(--bg-input); display: flex; align-items: center; justify-content: center; font-size: 2rem;">👤</div>`;

        container.innerHTML = `
            <div style="${sectionStyle}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0;">👤 My Info</h3>
                    <button onclick="handleProfileEditToggle()" class="nav-btn icon-only" title="Edit Profile" style="font-size: 1rem; padding: 0.4rem 0.6rem;">
                        ✏️ Edit
                    </button>
                </div>

                <div style="display: flex; align-items: center; gap: 20px;">
                    ${picHtml}
                    <div>
                        <h4 style="margin: 0 0 5px 0; font-size: 1.1rem; color: var(--text-main);">${user.firstName} ${user.lastName}</h4>
                        <p style="margin: 0 0 5px 0; color: var(--text-subtle); font-size: 0.9rem;">${userEmail}</p>
                        <div style="font-size: 0.9rem; color: var(--text-subtle); display: flex; gap: 15px;">
                             <span>📞 ${user.phone || 'Not set'}</span>
                             <span>🏙️ ${user.city || 'Not set'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Edit Mode
        const picReview = user.profilePic
            ? `<img id="previewPic" src="${user.profilePic}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;">`
            : '';

        container.innerHTML = `
             <div style="${sectionStyle}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; color: var(--primary);">👤 edit info</h3>
                </div>
                
                <div style="margin-bottom: 20px; display: flex; align-items: center; gap: 15px;">
                    ${picReview}
                    <label class="nav-btn" style="cursor: pointer; font-size: 0.9rem; padding: 0.5rem 1rem;">
                        📷 Change Photo
                        <input type="file" id="editProfilePic" accept="image/*" style="display: none;">
                    </label>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    <div>
                        <label for="editFirstName" style="display: block; margin-bottom: 5px; font-weight: 500;">First Name <span class="required" style="color: var(--error);">*</span></label>
                        <input type="text" id="editFirstName" value="${user.firstName}" required>
                    </div>
                    <div>
                        <label for="editLastName" style="display: block; margin-bottom: 5px; font-weight: 500;">Last Name <span class="required" style="color: var(--error);">*</span></label>
                        <input type="text" id="editLastName" value="${user.lastName}" required>
                    </div>
                </div>

                <div style="margin-bottom: 15px;">
                    <label for="editCity" style="display: block; margin-bottom: 5px; font-weight: 500;">City</label>
                    <input type="text" id="editCity" value="${user.city || ''}" placeholder="e.g. San Francisco">
                </div>

                <div style="margin-bottom: 20px;">
                    <label for="editPhone" style="display: block; margin-bottom: 5px; font-weight: 500;">Phone</label>
                    <input type="tel" id="editPhone" value="${user.phone || ''}" placeholder="e.g. 555-0123">
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button onclick="handleProfileEditToggle()" class="nav-btn">Cancel</button>
                    <button onclick="handleProfileSave()" class="primary-btn" style="width: auto;">Save Changes</button>
                </div>
             </div>
        `;

        // Attach Enter triggers to new inputs
        setTimeout(() => {
            addEnterTrigger('editFirstName', handleProfileSave);
            addEnterTrigger('editLastName', handleProfileSave);
            addEnterTrigger('editCity', handleProfileSave);
            addEnterTrigger('editPhone', handleProfileSave);
        }, 0);
    }
}

function handleProfileEditToggle() {
    isEditingProfile = !isEditingProfile;
    renderMyInfo();
}

async function handleProfileSave() {
    const firstName = document.getElementById('editFirstName').value.trim();
    const lastName = document.getElementById('editLastName').value.trim();
    const city = document.getElementById('editCity').value;
    const phone = document.getElementById('editPhone').value;
    const fileInput = document.getElementById('editProfilePic');

    if (!firstName || !lastName) {
        showNotification("First Name and Last Name are required.");
        return;
    }

    let profilePic = null;

    // Check if image updated
    if (fileInput && fileInput.files && fileInput.files[0]) {
        try {
            profilePic = await resizeImage(fileInput.files[0]);
        } catch (e) {
            showNotification("Error processing image: " + e);
            return;
        }
    }

    const data = { firstName, lastName, city, phone };
    if (profilePic) {
        data.profilePic = profilePic;
    }

    const result = AuthService.updateProfile(data);
    if (result.success) {
        isEditingProfile = false;
        renderMyInfo();
        // Also update welcome message in main UI
        updateAuthUI();
    } else {
        showNotification(result.message);
    }
}

// Image Resizer Helper
function resizeImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 150;
                const MAX_HEIGHT = 150;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Return Base64
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}


function handleAddLocation() {
    const aliasInput = document.getElementById('newLocAlias');
    const addressInput = document.getElementById('newLocAddress');
    const alias = aliasInput.value.trim();
    const address = addressInput.value.trim().toLowerCase();

    if (!alias || !address) {
        showNotification("Please enter a name and address.");
        return;
    }

    // Use the temporarily stored place if available from the autocomplete listener
    const result = AuthService.saveLocation(alias, address, tempSavedPlace);
    if (result.success) {
        tempSavedPlace = null; // Clear after use
        aliasInput.value = '';
        addressInput.value = '';

        // Final attempt to clear web component state
        try {
            const innerInput = addressInput.shadowRoot?.querySelector('input');
            if (innerInput) innerInput.value = '';
        } catch (e) { }

        renderManageLocations();
        renderLocationChips();
    } else {
        showNotification(result.message);
    }
}

function handleDeleteLocation(alias) {
    if (confirm(`Delete location "${alias}"?`)) {
        AuthService.deleteLocation(alias);
        renderManageLocations();
        renderLocationChips();
    }
}

// Helper to get emoji based on location alias
function getLocationEmoji(alias) {
    const lower = alias.toLowerCase();
    if (lower.includes('home')) return '🏠';
    if (lower.includes('work') || lower.includes('office')) return '🏢';
    if (lower.includes('gym') || lower.includes('fitness')) return '🏋️';
    if (lower.includes('school') || lower.includes('university') || lower.includes('college')) return '🎓';
    if (lower.includes('bar') || lower.includes('pub') || lower.includes('brewery')) return '🍺';
    if (lower.includes('coffee') || lower.includes('cafe')) return '☕';
    if (lower.includes('park')) return '🌳';
    if (lower.includes('shop') || lower.includes('store') || lower.includes('mall') || lower.includes('market')) return '🛍️';
    if (lower.includes('doctor') || lower.includes('hospital') || lower.includes('clinic')) return '🏥';
    if (lower.includes('restaurant') || lower.includes('diner') || lower.includes('food')) return '🍽️';
    return '📍';
}

// Render chips on the main screen
function renderLocationChips() {
    const locations = AuthService.getLocations();
    const chipsA = document.getElementById('chipsA');
    if (!chipsA) return;

    chipsA.innerHTML = locations.map(loc => {
        const emoji = getLocationEmoji(loc.alias);
        const safeAddr = loc.address.replace(/'/g, "\\'");
        return `<button type="button" onclick="setAddress('addressA', '${safeAddr}')" 
            style="padding: 2px 8px; margin-right: 5px; border-top-right-radius: 12px; border-bottom-right-radius: 12px; border-top-left-radius: 12px; border-bottom-left-radius: 12px; border: 1px solid var(--border-subtle); background: var(--bg-input); cursor: pointer; font-size: 0.85rem; color: var(--text-main); transition: all 0.2s ease;">
            ${emoji} ${loc.alias}
        </button>`;
    }).join('');
}

function setAddress(elementId, address) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const safeAddr = address.toLowerCase();

    // 1. Force Focus and select all existing text
    el.focus();

    // 2. Clear current value and use execCommand to simulate real "input"
    // This is the most reliable way to trigger internal logic in closed Shadow DOMs
    try {
        el.value = '';
        document.execCommand('insertText', false, safeAddr);
    } catch (e) {
        // Fallback for environments where execCommand is restricted
        el.value = safeAddr;
    }

    // 3. Synchronize attributes and dispatch events
    el.setAttribute('value', safeAddr);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

    // 4. Update internal global state
    const locations = AuthService.getLocations();
    const found = locations.find(l => l.address === address);
    if (found && found.place) {
        if (elementId === 'addressA') selectedPlaceA = found.place;
        else if (elementId === 'addressB') selectedPlaceB = found.place;
        else if (elementId.startsWith('friend-address-')) friendPlaces[elementId] = found.place;
    }

    // 5. Blur to finalize UI state
    setTimeout(() => {
        el.blur();
    }, 100);
}

// Handle Save Preferences
// Handle Save Preferences
function handleSavePreferences() {
    const defaultMode = document.getElementById('prefDefaultMode').value;
    const defaultType = document.getElementById('prefDefaultType').value;
    const defaultSort = document.getElementById('prefDefaultSort').value;

    // Get Rating
    const ratingInput = document.getElementById('prefDefaultRating');
    const defaultRating = ratingInput ? parseFloat(ratingInput.value) : 0;

    console.log('Saving preferences:', { defaultMode, defaultType, defaultSort, defaultRating });
    console.log('Current user:', AuthService.getCurrentUser());

    const result = AuthService.savePreferences({
        defaultMode: defaultMode,
        defaultType: defaultType,
        defaultSort: defaultSort,
        defaultRating: defaultRating
    });

    console.log('Save result:', result);

    if (result && result.success) {
        showNotification('Preferences saved!', 'success');
        // Apply to current form
        loadUserPreferences();
    } else {
        showNotification(result?.message || 'Failed to save preferences. Please make sure you are logged in.');
    }
}

// Load and apply user preferences to form
// Load and apply user preferences to form
function loadUserPreferences() {
    const prefs = AuthService.getPreferences();
    if (!prefs) return;

    // Apply to search form
    if (prefs.defaultMode !== undefined) {
        document.getElementById('modeA').value = prefs.defaultMode;
        document.getElementById('modeA').value = prefs.defaultMode;

        const sync = (id, val) => {
            const sel = document.getElementById(id);
            if (sel) {
                sel.value = val;
                const wrapper = sel.closest('.custom-dropdown');
                if (wrapper) {
                    const opt = wrapper.querySelector(`.dropdown-option[data-value="${val}"]`);
                    const trig = wrapper.querySelector('.dropdown-trigger');
                    if (opt && trig) trig.textContent = opt.textContent;
                }
            }
        };
        sync('modeA', prefs.defaultMode);
    }

    if (prefs.defaultType !== undefined) {
        document.getElementById('placeType').value = prefs.defaultType;
    }

    if (prefs.defaultSort !== undefined) {
        // Handle Main Form (Cards)
        if (document.getElementById('btnFairness') && document.getElementById('btnSpeed')) {
            document.getElementById('sortPreference').value = prefs.defaultSort;
            setPriority(prefs.defaultSort);
        } else {
            // Fallback if cards not present (e.g. if we revert)
            document.getElementById('sortPreference').value = prefs.defaultSort;
        }

        // Handle Profile Form (Dropdown) - reusing existing logic for 'prefDefaultSort'
    }

    // Apply Rating to Search Form
    if (prefs.defaultRating !== undefined) {
        const searchInput = document.getElementById('minRating');
        if (searchInput) {
            searchInput.value = prefs.defaultRating;
            if (window.renderStars) renderStars('starRatingSearch', prefs.defaultRating);
        }
    }

    // Apply to preferences form (for display in Profile modal)
    const prefModeEl = document.getElementById('prefDefaultMode');
    const prefTypeEl = document.getElementById('prefDefaultType');
    const prefSortEl = document.getElementById('prefDefaultSort');
    const prefRatingEl = document.getElementById('prefDefaultRating');

    // Always apply saved values to the preference dropdowns when opening Profile
    if (prefModeEl && prefs.defaultMode !== undefined) {
        prefModeEl.value = prefs.defaultMode;
        // Need to sync custom dropdown UI too
        const wrapper = prefModeEl.closest('.custom-dropdown');
        if (wrapper && prefs.defaultMode) {
            const opt = wrapper.querySelector(`.dropdown-option[data-value="${prefs.defaultMode}"]`);
            const trig = wrapper.querySelector('.dropdown-trigger');
            if (opt && trig) trig.textContent = opt.textContent;
        }
    }
    if (prefTypeEl && prefs.defaultType !== undefined) prefTypeEl.value = prefs.defaultType;
    if (prefSortEl && prefs.defaultSort !== undefined) {
        prefSortEl.value = prefs.defaultSort;
        const wrapper = prefSortEl.closest('.custom-dropdown');
        if (wrapper && prefs.defaultSort) {
            const opt = wrapper.querySelector(`.dropdown-option[data-value="${prefs.defaultSort}"]`);
            const trig = wrapper.querySelector('.dropdown-trigger');
            if (opt && trig) trig.textContent = opt.textContent;
        }
    }

    if (prefRatingEl && prefs.defaultRating !== undefined) {
        prefRatingEl.value = prefs.defaultRating;
        // Apply to preferences form (for display in Profile modal)
        // ... Note: The preferences modal still uses the old dropdowns for now, or we can update it too. 
        // The user specifically asked for "prioritization options using human language", implies the main form first.
        // However, for consistency, let's just make sure the main form logic (loadUserPreferences) handles the new cards.

        // Existing logic for dropdowns (Profile Modal still has them).


    }
}

// New Helper for Priority Cards
function setPriority(value) {
    // Update hidden select
    const select = document.getElementById('sortPreference');
    if (select) select.value = value;

    // Update Visuals
    const btnFairness = document.getElementById('btnFairness');
    const btnSpeed = document.getElementById('btnSpeed');

    if (btnFairness) btnFairness.classList.remove('selected');
    if (btnSpeed) btnSpeed.classList.remove('selected');

    if (value === 'FAIRNESS' && btnFairness) btnFairness.classList.add('selected');
    if (value === 'SPEED' && btnSpeed) btnSpeed.classList.add('selected');
}

// Expose functions
window.toggleProfileModal = toggleProfileModal;
window.handleAddLocation = handleAddLocation;
window.handleDeleteLocation = handleDeleteLocation;
window.setAddress = setAddress;
window.handleSavePreferences = handleSavePreferences;
window.setPriority = setPriority;

let editingLocationIndex = null;

function renderManageLocations() {
    const listDiv = document.getElementById('locationsList');
    const locations = AuthService.getLocations();

    if (locations.length === 0) {
        listDiv.innerHTML = '<p>No saved locations.</p>';
        return;
    }

    listDiv.innerHTML = locations.map((loc, index) => {
        // Edit Mode
        if (editingLocationIndex === index) {
            return `
            <div style="margin-bottom: 10px; padding: 15px; background: var(--secondary); border: 1px solid var(--primary); border-radius: var(--radius-md); display: flex; gap: 10px; align-items: center;">
                <input type="text" id="editAliasInput" value="${loc.alias}" style="flex: 1; margin: 0;">
                <button onclick="handleSaveRename(${index})" class="primary-btn" style="width: auto; padding: 0.5rem 1rem;">Save</button>
                <button onclick="handleCancelEdit()" class="nav-btn" style="width: auto; border: 1px solid var(--border-subtle);">Cancel</button>
            </div>`;
        }

        // View Mode
        const emoji = getLocationEmoji(loc.alias);
        return `
        <div 
            class="location-item"
            draggable="true" 
            ondragstart="handleDragStart(event, ${index})" 
            ondragover="handleDragOver(event)" 
            ondragleave="handleDragLeave(event)"
            ondrop="handleDrop(event, ${index})"
            style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 12px 15px; background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); cursor: grab; transition: all 0.2s;">
            <div style="color: var(--text-main); font-size: 0.95rem;">
                <strong style="color: var(--primary);">${emoji} ${loc.alias.toLowerCase()}</strong>: ${loc.address}
            </div>
            <div style="display: flex; gap: 5px;">
                <button onclick="handleEditMode(${index})" class="nav-btn icon-only" title="Rename" style="font-size: 0.9rem; border: 1px solid var(--border-subtle);">✏️</button>
                <button onclick="handleDeleteLocation('${loc.alias}')" class="nav-btn icon-only" title="Delete" style="font-size: 0.9rem; background: #fff5f5; border: 1px solid #fecaca;">🗑️</button>
            </div>
        </div>`;
    }).join('');

    // Add Enter key listener for dynamic edit input
    if (editingLocationIndex !== null) {
        addEnterTrigger('editAliasInput', () => handleSaveRename(editingLocationIndex));
    }
}

function handleEditMode(index) {
    editingLocationIndex = index;
    renderManageLocations();
}

function handleCancelEdit() {
    editingLocationIndex = null;
    renderManageLocations();
}

function handleSaveRename(index) {
    const input = document.getElementById('editAliasInput');
    const newAlias = input.value.trim();

    if (!newAlias) {
        showNotification("Name cannot be empty.");
        return;
    }

    const result = AuthService.renameLocation(index, newAlias);
    if (result.success) {
        editingLocationIndex = null;
        renderManageLocations();
        renderLocationChips();
    } else {
        showNotification(result.message);
    }
}

// Drag and Drop Handlers
let draggedIndex = null;

function handleDragStart(e, index) {
    draggedIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index); // Required for Firefox
    e.target.classList.add('dragging');
}

function handleDragOver(e) {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';

    // Add visual cue
    const targetItem = e.target.closest('.location-item');
    if (targetItem && targetItem !== e.target) {
        targetItem.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const targetItem = e.target.closest('.location-item');
    if (targetItem) {
        targetItem.classList.remove('drag-over');
    }
}

function handleDrop(e, targetIndex) {
    e.preventDefault();

    // Clean up visuals
    const items = document.querySelectorAll('.location-item');
    items.forEach(item => {
        item.classList.remove('drag-over');
        item.classList.remove('dragging');
    });

    if (draggedIndex !== null && draggedIndex !== targetIndex) {
        AuthService.reorderLocation(draggedIndex, targetIndex);
        renderManageLocations();
        renderLocationChips();
    }
    draggedIndex = null;
}

// Expose handlers
window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;
window.handleDrop = handleDrop;
window.handleEditMode = handleEditMode;
window.handleCancelEdit = handleCancelEdit;
window.handleSaveRename = handleSaveRename;
window.handleProfileEditToggle = handleProfileEditToggle;
window.handleProfileSave = handleProfileSave;
window.handleAddLocation = handleAddLocation;
window.handleDeleteLocation = handleDeleteLocation;

// History UI Helpers
function toggleHistoryModal() {
    const modal = document.getElementById('historyModal');
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        renderHistory();
        modal.style.display = 'flex';
    }
}

function renderHistory() {
    const listDiv = document.getElementById('historyList');
    const history = AuthService.getHistory();

    if (history.length === 0) {
        listDiv.innerHTML = '<p>no history yet.</p>';
        return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
    history.forEach((h, index) => {
        const date = new Date(h.date).toLocaleDateString();
        // Escape quotes to prevent HTML breaking
        const safeType = h.type.replace(/'/g, "\\'");
        const safeAddrA = h.addrA.replace(/'/g, "\\'");
        const safeAddrB = h.addrB.replace(/'/g, "\\'");

        html += `
        <div onclick="restoreHistorySearch(${index})" class="history-item">
            <div class="history-date">${date}</div>
            <div class="history-type">${h.type}</div>
            <div class="history-details">
                <span class="history-badge badge-a">A</span> ${safeAddrA}<br>
                <div style="height:4px"></div>
                <span class="history-badge badge-b">B</span> ${safeAddrB}
            </div>
        </div>`;
    });
    html += '</div>';
    listDiv.innerHTML = html;
}

function restoreHistorySearch(index) {
    const history = AuthService.getHistory();
    const item = history[index];
    if (!item) return;

    // Fill inputs
    const elA = document.getElementById('addressA');
    const elB = document.getElementById('addressB');
    const elType = document.getElementById('placeType');

    if (elA) elA.value = item.addrA;
    if (elB) elB.value = item.addrB;
    if (elType) elType.value = item.type;

    // Close modal
    toggleHistoryModal();

    // Trigger search
    // Slight delay to ensure modal closes smoothly first
    setTimeout(() => {
        findMidpoint();
    }, 300);
}

window.toggleHistoryModal = toggleHistoryModal;
window.restoreHistorySearch = restoreHistorySearch;

function initMap() {
    // Initialize the map centered on a default location
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 4,
        center: { lat: 39.8283, lng: -98.5795 }, // Center of US
        mapId: "DEMO_MAP_ID", // Required for Advanced Markers
    });
    geocoder = new google.maps.Geocoder();
    // InfoWindow as a sleek tooltip (no header/close button)
    infoWindow = new google.maps.InfoWindow({
        headerDisabled: true
    });

    // Check Auth Status on Load (also updates UI which includes chips)
    updateAuthUI();

    // Apply saved preferences (travel mode, place type, prioritization)
    applyPreferences();

    // Listen for place selections
    const autocompleteA = document.getElementById("addressA");
    const autocompleteB = document.getElementById("addressB");

    // Generic lowercase enforcement for all autocompletes
    document.querySelectorAll('gmp-place-autocomplete').forEach(el => {
        el.addEventListener('gmp-places-place-select', (event) => {
            // Force lowercase value after a slight delay to let component update
            setTimeout(() => {
                if (el.value) {
                    el.value = el.value.toLowerCase();
                }
            }, 10);

            // Update specific references if needed
            if (el.id === 'addressA') selectedPlaceA = event.detail.place;
            if (el.id === 'addressB') selectedPlaceB = event.detail.place;
            if (el.id === 'newLocAddress') tempSavedPlace = event.detail.place;
        });
    });

    // Check for URL parameters and pre-fill form
    const params = new URLSearchParams(window.location.search);
    if (params.has('addrA')) {
        // For component value (text) fallback
        if (autocompleteA) autocompleteA.value = params.get('addrA');
        if (autocompleteB) autocompleteB.value = params.get('addrB') || '';

        document.getElementById('modeA').value = params.get('modeA') || 'DRIVING';
        document.getElementById('modeB').value = params.get('modeB') || 'DRIVING';
        document.getElementById('placeType').value = params.get('type') || '';
        document.getElementById('sortPreference').value = params.get('sort') || 'FAIRNESS';

        const ratingParam = params.get('minRating');
        if (ratingParam) {
            const r = parseFloat(ratingParam);
            const rInput = document.getElementById('minRating');
            if (rInput && !isNaN(r)) {
                rInput.value = r;
                // Wait for renderStars availability if needed, but it should be there
                setTimeout(() => {
                    if (window.renderStars) renderStars('starRatingSearch', r);
                }, 100);
            }
        }

        if (params.get('addrB') && params.get('type')) {
            setTimeout(() => findMidpoint(), 800);
        }
    }

    // Enter Key Listeners
    const inputs = [document.getElementById("addressA"), document.getElementById("addressB"), document.getElementById("placeType")];
    inputs.forEach(input => {
        if (input) {
            input.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    // Slight delay to allow autocomplete selection to register if that was the intent
                    setTimeout(() => findMidpoint(), 100);
                }
            });
        }
    });


}

// Generate shareable link
function shareSearch() {
    const addressA = document.getElementById('addressA').value;
    const addressB = document.getElementById('addressB').value;
    const modeA = document.getElementById('modeA').value;
    const modeB = document.getElementById('modeB').value;
    const placeType = document.getElementById('placeType').value;
    const sortPref = document.getElementById('sortPreference').value;

    if (!addressA || !addressB || !placeType) {
        showNotification('Please fill in both addresses and a place type before sharing.');
        return;
    }

    const params = new URLSearchParams({
        addrA: addressA,
        addrB: addressB,
        modeA: modeA,
        modeB: modeB,
        type: placeType,
        sort: sortPref,
        minRating: document.getElementById('minRating') ? document.getElementById('minRating').value : '0'
    });

    const shareUrl = window.location.origin + window.location.pathname + '?' + params.toString();

    // Copy to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
        showNotification('Link copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback: show the URL in a prompt
        prompt('Copy this link:', shareUrl);
    });
}

window.shareSearch = shareSearch;






let originMarkers = []; // Array of AdvancedMarkerElement

function findMidpoint() {
    const locations = getAllLocations();
    if (!locations) return; // Validation failed

    // Validation
    if (locations.length < 2) {
        showNotification("Please enter at least 2 locations (You + Friend).");
        return;
    }

    // Centroid Calculation
    // But first, we need to Geocode any text-based addresses
    // This is async. We handle one by one or Promise.all.

    // Helper to geocode single location
    const resolveLocation = (loc) => {
        return new Promise((resolve) => {
            if (loc.place && loc.place.location) {
                loc.latLng = loc.place.location;
                resolve(loc);
            } else {
                // Safety timeout for geocoder
                const timeoutId = setTimeout(() => {
                    console.warn(`Geocode timed out for ${loc.label}`);
                    resolve(null);
                }, 8000);

                try {
                    geocoder.geocode({ address: loc.address }, (results, status) => {
                        clearTimeout(timeoutId);
                        if (status === "OK" && results && results.length > 0) {
                            loc.latLng = results[0].geometry.location;
                            resolve(loc);
                        } else {
                            console.error(`Geocode failed for ${loc.label}: ${status}`);
                            resolve(null);
                        }
                    });
                } catch (e) {
                    clearTimeout(timeoutId);
                    console.error("Geocode Sync Error:", e);
                    resolve(null);
                }
            }
        });
    };

    Promise.all(locations.map(resolveLocation)).then(resolvedLocs => {
        const validLocs = resolvedLocs.filter(l => l && l.latLng);

        if (validLocs.length < 2) {
            showNotification("Could not geocode locations. Please try valid addresses.");
            return;
        }

        // Calculate Centroid
        let sumLat = 0;
        let sumLng = 0;
        validLocs.forEach(l => {
            sumLat += l.latLng.lat();
            sumLng += l.latLng.lng();
        });

        const midpoint = {
            lat: sumLat / validLocs.length,
            lng: sumLng / validLocs.length
        };

        // Clear Old Markers
        if (midpointMarker) midpointMarker.map = null;
        if (originMarkers.length > 0) {
            originMarkers.forEach(m => m.map = null);
            originMarkers = [];
        }
        // Also clear A/B global markers just in case
        if (markerA) markerA.map = null;
        if (markerB) markerB.map = null;

        // Create Midpoint Marker
        const pinMid = new google.maps.marker.PinElement({
            glyphText: "M",
            background: "#435f30",
            borderColor: "#435f30",
            glyphColor: "#ffffff"
        });
        midpointMarker = new google.maps.marker.AdvancedMarkerElement({
            position: midpoint,
            map: map,
            title: "midpoint",
            content: pinMid
        });

        // Create Origin Markers
        validLocs.forEach((loc, index) => {
            let shortLabel = loc.label.toLowerCase();
            if (shortLabel.includes('your')) shortLabel = 'you';
            else if (shortLabel.includes('friend')) {
                shortLabel = shortLabel.replace("'s starting point", "").trim();
            }

            // Create a custom HTML element for the user marker
            const markerDiv = document.createElement('div');
            markerDiv.innerHTML = `
                <div style="background: #435f30; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.3); position: relative; transform: translateY(-10px);">
                    ${shortLabel}
                    <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid #435f30;"></div>
                </div>
            `;

            const marker = new google.maps.marker.AdvancedMarkerElement({
                position: loc.latLng,
                map: map,
                title: loc.label,
                content: markerDiv
            });
            originMarkers.push(marker);
        });

        // Center map
        map.setCenter(midpoint);
        map.setZoom(13);

        // Find Places
        findPlaces(midpoint, validLocs);
    });
}

let placeMarkers = [];

async function findPlaces(midpoint, locations) {
    const type = document.getElementById('placeType').value;
    if (!type) {
        showNotification("Please enter a place type.");
        return;
    }

    // Determine Radius: Max distance from centroid to any point
    let maxDist = 0;
    locations.forEach(l => {
        const d = google.maps.geometry.spherical.computeDistanceBetween(midpoint, l.latLng);
        if (d > maxDist) maxDist = d;
    });

    let searchRadius = maxDist;
    searchRadius = Math.max(1000, searchRadius);
    searchRadius = Math.min(50000, searchRadius);

    // Clear old place markers
    placeMarkers.forEach(marker => marker.map = null);
    placeMarkers = [];

    // Clear results
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<h3 style="margin-bottom: 1.25rem;">results:</h3><p>loading fair transit options...</p>';

    try {
        const { Place, PriceLevel } = await google.maps.importLibrary("places");

        const maxPrice = parseInt(document.getElementById('maxPrice').value) || 0;
        const priceLevels = [];
        if (maxPrice > 0) {
            // Include everything up to maxPrice
            if (maxPrice >= 1) priceLevels.push(PriceLevel.INEXPENSIVE);
            if (maxPrice >= 2) priceLevels.push(PriceLevel.MODERATE);
            if (maxPrice >= 3) priceLevels.push(PriceLevel.EXPENSIVE);
            if (maxPrice >= 4) priceLevels.push(PriceLevel.VERY_EXPENSIVE);
        }

        const requestOptions = {
            textQuery: type,
            fields: ['displayName', 'location', 'rating', 'userRatingCount', 'formattedAddress', 'photos', 'websiteURI', 'nationalPhoneNumber', 'regularOpeningHours', 'priceLevel', 'googleMapsURI'],
            minRating: parseFloat(document.getElementById('minRating').value) || 0,
            locationBias: {
                center: midpoint,
                radius: searchRadius
            },
            maxResultCount: 10
        };

        if (priceLevels.length > 0) {
            requestOptions.priceLevels = priceLevels;
        }

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Search timed out")), 15000);
        });

        const { places } = await Promise.race([
            Place.searchByText(requestOptions),
            timeoutPromise
        ]);

        if (!places || places.length === 0) {
            resultsDiv.innerHTML = '<p>No places found. Try a different search term.</p>';
            return;
        }

        const limitedResults = places.slice(0, 10);
        const destinations = limitedResults.map(p => p.location);

        // Mode Emojis
        const modeEmojis = {
            'TRANSIT': '🚍',
            'DRIVING': '🚗',
            'WALKING': '🚶',
            'BICYCLING': '🚲'
        };

        // Departure Time
        const departureInput = document.getElementById('departureTime').value;
        const departureTime = departureInput ? new Date(departureInput) : new Date();

        const matrixService = new google.maps.DistanceMatrixService();

        // Helper: Get Times for ONE origin to ALL destinations
        const getTimesForOrigin = (originLoc, mode) => {
            return new Promise((resolve) => {
                // Safety check for origin
                if (!originLoc || !originLoc.latLng) {
                    console.error("Invalid origin location for distance matrix:", originLoc);
                    resolve(null);
                    return;
                }

                // Safety timeout
                const timeoutId = setTimeout(() => {
                    console.warn(`Distance Matrix timed out for ${mode}`);
                    resolve(null);
                }, 8000); // 8 second timeout

                const request = {
                    origins: [originLoc.latLng],
                    destinations: destinations,
                    travelMode: google.maps.TravelMode[mode] || google.maps.TravelMode.DRIVING,
                };

                const now = new Date();
                if (mode === 'TRANSIT') {
                    request.transitOptions = { departureTime: departureTime };
                } else if (mode === 'DRIVING') {
                    if (departureTime >= now) { // Only future
                        request.drivingOptions = { departureTime: departureTime };
                    }
                }

                try {
                    matrixService.getDistanceMatrix(request, (response, status) => {
                        clearTimeout(timeoutId);
                        if (status === "OK" && response && response.rows && response.rows.length > 0) {
                            resolve(response.rows[0].elements);
                        } else {
                            console.warn(`Distance Matrix failed or empty for ${mode}: ${status}`);
                            resolve(null);
                        }
                    });
                } catch (e) {
                    clearTimeout(timeoutId);
                    console.error("Distance Matrix Sync Error:", e);
                    resolve(null);
                }
            });
        };

        // Parallel Requests for ALL origins
        const allResults = await Promise.all(
            locations.map(loc => getTimesForOrigin(loc, loc.mode))
        );

        // Check if any failed completely
        if (allResults.some(r => !r)) {
            resultsDiv.innerHTML = '<p style="color: red;">Could not calculate travel times. Please try again.</p>';
            return;
        }

        // Combine Results
        const rankedPlaces = limitedResults.map((place, placeIndex) => {
            const placeTimes = [];
            let totalTime = 0;
            let maxTime = 0;
            let minTime = Infinity;
            let valid = true;

            // Loop through each origin's result for THIS place
            locations.forEach((loc, locIndex) => {
                const element = allResults[locIndex][placeIndex];
                if (element.status !== "OK") {
                    valid = false;
                }
                const val = element.status === "OK" ? element.duration.value : Infinity;
                const text = element.status === "OK" ? element.duration.text : "No route";

                placeTimes.push({
                    val: val,
                    text: text,
                    label: loc.label, // "Your starting point", "Friend 1", etc.
                    mode: loc.mode,
                    type: loc.type,
                    origin: loc.latLng // Needed for directions links
                });

                if (val !== Infinity) {
                    totalTime += val;
                    if (val > maxTime) maxTime = val;
                    if (val < minTime) minTime = val;
                }
            });

            // Calculate Fairness (Max Difference)
            let timeDiff = 0;
            if (minTime !== Infinity) {
                timeDiff = maxTime - minTime; // Range
            } else {
                timeDiff = Infinity;
            }

            return {
                place: place,
                times: placeTimes,
                totalTime: totalTime,
                timeDiff: timeDiff,
                maxTime: maxTime,
                minTime: minTime,
                valid: valid
            };
        });

        // Sort
        const sortPref = document.getElementById('sortPreference').value;
        rankedPlaces.sort((a, b) => {
            if (!a.valid && !b.valid) return 0;
            if (!a.valid) return 1;
            if (!b.valid) return -1;

            if (sortPref === 'SPEED') {
                if (a.totalTime !== b.totalTime) return a.totalTime - b.totalTime;
                return a.timeDiff - b.timeDiff;
            } else {
                if (a.timeDiff !== b.timeDiff) return a.timeDiff - b.timeDiff;
                return a.totalTime - b.totalTime;
            }
        });

        // Render Results
        let html = `<h3 style="margin-bottom: 1.25rem;">results (sorted by ${sortPref === 'SPEED' ? 'speed' : 'fairness'}):</h3>`;
        resultsDiv.innerHTML = html;

        // Show share button
        const shareBtn = document.getElementById('shareBtn');
        if (shareBtn) shareBtn.style.display = 'inline-block';

        // Store globally
        window.currentRankedPlaces = rankedPlaces;
        // Simplified currentSearchData for history? Just store main ones or summary?
        // For now, keep history simple (maybe just A/B or first 2?).
        // TODO: Update history logic if needed.

        rankedPlaces.forEach((item, index) => {
            // Create Pin with Pale Sage background
            const pin = new google.maps.marker.PinElement({
                glyphText: (index + 1).toString(),
                background: "#e8ede4", // var(--secondary) Pale Sage
                borderColor: "transparent",
                glyphColor: "#435f30"  // var(--primary) Olive Leaf
            });

            const marker = new google.maps.marker.AdvancedMarkerElement({
                map: map,
                position: item.place.location,
                title: (item.place.displayName || "").toLowerCase(),
                content: pin,
                collisionBehavior: google.maps.CollisionBehavior.REQUIRED,
                zIndex: 0
            });
            placeMarkers.push(marker);

            // Hover Content Generator
            const getTooltipContent = (name) => `
                <div style="background: #435f30; color: white; padding: 6px 14px; border-radius: 12px; font-size: 0.9rem; font-weight: 500; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                    ${name.toLowerCase()}
                </div>
            `;

            // Function to handle hover in
            const showHover = () => {
                marker.zIndex = 1000;
                marker.content.style.transition = "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
                marker.content.style.transform = "scale(1.25)";
                pin.background = "#435f30"; // Flip color on hover
                pin.glyphColor = "#ffffff";

                infoWindow.setContent(getTooltipContent(item.place.displayName || ""));
                infoWindow.open(map, marker);
            };

            // Function to handle hover out
            const hideHover = () => {
                marker.zIndex = 0;
                marker.content.style.transform = "scale(1)";
                pin.background = "#e8ede4";
                pin.glyphColor = "#435f30";
                infoWindow.close();
            };

            // Map Pin Hover Listeners
            marker.content.addEventListener("mouseenter", showHover);
            marker.content.addEventListener("mouseleave", hideHover);

            // Make Pin Clickable -> Open Detail Modal
            marker.addListener('click', () => {
                openPlaceDetail(index);
            });

            // Explanation / Times Display
            let explanation = item.valid ? "" : "🚫 No valid route for some participants.";

            // Build Time Chips
            let timesHtml = `<div style="font-size: 0.9rem; margin-bottom: 8px; display: flex; gap: 6px; flex-wrap: wrap;">`;

            // Count friends for numbering context
            const friendCount = item.times.filter(t => t.type === 'FRIEND').length;

            item.times.forEach(t => {
                let shortLabel = t.label.toLowerCase();
                if (shortLabel.includes('your')) shortLabel = 'you';
                else if (shortLabel.includes('friend')) {
                    if (shortLabel.includes('starting')) shortLabel = shortLabel.replace("'s starting point", "");
                    // Handle "friend" vs "friend 1"
                    if (shortLabel.trim() === 'friend') {
                        shortLabel = (friendCount > 1) ? 'friend 1' : 'friend';
                    }
                }

                timesHtml += `<span style="background: var(--secondary); padding: 2px 8px; border-radius: 4px;">${modeEmojis[t.mode]} ${shortLabel.trim()}: <strong>${t.text}</strong></span>`;
            });
            timesHtml += `</div>`;

            // Explanation Logic
            if (item.timeDiff !== Infinity && item.totalTime > 0) {
                // Ratio calculation (using 60s floor to avoid Infinity on ultra-short trips)
                const ratio = item.minTime > 0 ? (item.maxTime / Math.max(item.minTime, 60)) : (item.maxTime > 0 ? Infinity : 1);

                // Very Fair: Abs diff <= 7 mins AND Ratio <= 1.25
                const isVeryFair = item.timeDiff <= 420 && ratio <= 1.25;
                // Fair: Abs diff <= 15 mins AND Ratio <= 1.5
                const isFair = !isVeryFair && item.timeDiff <= 900 && ratio <= 1.5;

                if (isVeryFair) {
                    explanation = `✅ <strong>Very Fair!</strong> Balanced travel times.`;
                } else if (isFair) {
                    explanation = `⚖️ <strong>Fair.</strong> Reasonably balanced travel.`;
                } else if (item.timeDiff > 1200) { // > 20 mins
                    explanation = `⚠️ Large difference in travel times.`;
                }
            }

            // Price Level
            let priceSpan = '';
            if (item.place.priceLevel !== undefined && item.place.priceLevel !== null) {
                const priceMap = {
                    'PRICE_LEVEL_FREE': 'Free',
                    'PRICE_LEVEL_INEXPENSIVE': '$',
                    'PRICE_LEVEL_MODERATE': '$$',
                    'PRICE_LEVEL_EXPENSIVE': '$$$',
                    'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$',
                    'FREE': 'Free',
                    'INEXPENSIVE': '$',
                    'MODERATE': '$$',
                    'EXPENSIVE': '$$$',
                    'VERY_EXPENSIVE': '$$$$',
                    0: 'Free', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$'
                };
                const priceLabel = priceMap[item.place.priceLevel] || item.place.priceLevel;
                priceSpan = `<span style="background: var(--secondary); color: var(--primary); padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; margin-right: 8px; display: inline-block;">${priceLabel}</span>`;
            }

            // Rating Display
            let ratingDisplay = '';
            if (item.place.rating) {
                const reviewCount = item.place.userRatingCount || 0;
                const fullStars = Math.floor(item.place.rating);
                const hasHalf = item.place.rating % 1 >= 0.25;
                ratingDisplay = `
                    <div style="display:flex; align-items:center; justify-content:flex-end; gap: 8px; margin-bottom: 2px; white-space: nowrap;">
                        ${priceSpan}
                        <div style="display:inline-flex; align-items:center; color:#f59e0b; font-size: 1.1rem; line-height: 1; flex-shrink: 0;">
                            ${'★'.repeat(fullStars)}
                            ${hasHalf ? '<span style="display:inline-block; overflow:hidden; width:0.5em; flex-shrink: 0;">★</span>' : ''}
                        </div>
                        <span style="color:var(--text-main); font-weight:600; font-size: 1rem; line-height: 1; flex-shrink: 0; margin-left: 2px;">${item.place.rating}</span>
                    </div>
                    <div style="color:var(--text-subtle);font-weight:400; font-size:0.85rem;">(${reviewCount} reviews)</div>
                `;
            } else {
                ratingDisplay = `
                    <div style="display:flex; align-items:center; justify-content:flex-end; white-space: nowrap;">
                        ${priceSpan}
                        <span style="color:var(--text-subtle);">No rating</span>
                    </div>
                `;
            }

            // Add to List
            const div = document.createElement('div');
            div.className = 'place-item';
            div.style.cursor = 'pointer';
            div.onclick = (e) => { if (!e.target.closest('a')) openPlaceDetail(index); };

            // Sidebar -> Map Pin Hover Interaction
            div.addEventListener('mouseenter', showHover);
            div.addEventListener('mouseleave', hideHover);

            // Highlight top result
            let topLabel = '';
            if (index === 0) {
                div.style.border = '2px solid var(--primary)';
                div.style.backgroundColor = 'rgba(67, 95, 48, 0.05)';
                topLabel = `<span style="background: var(--primary); color: white; padding: 4px 10px; border-radius: var(--radius-sm); font-size: 0.75rem; font-weight: 600; display: inline-block; margin-bottom: 8px;">🏆 best match</span><br>`;
            }

            div.innerHTML = `
                ${topLabel}
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <strong style="font-size: 1.05rem; color: var(--text-main);">#${index + 1} ${item.place.displayName.toLowerCase()}</strong>
                    </div>
                    <div style="text-align: right; min-width: 120px;">
                        ${ratingDisplay}
                    </div>
                </div>
                <div style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 8px;">${item.place.formattedAddress || ''}</div>
                ${timesHtml}
                <div style="font-size: 0.85rem; font-weight: 500;">${explanation}</div>
            `;
            resultsDiv.appendChild(div);
        });

    } catch (error) {
        console.error("Places API Error:", error);
        resultsDiv.innerHTML = '<p style="color: red;">Error searching for places. Please try again.</p>';
    }
}

// Place Detail Modal
function openPlaceDetail(index) {
    const data = window.currentRankedPlaces;
    if (!data || !data[index]) return;

    const item = data[index];
    const place = item.place;
    const modal = document.getElementById('placeDetailModal');
    const nameEl = document.getElementById('placeDetailName');
    const contentEl = document.getElementById('placeDetailContent');

    nameEl.textContent = place.displayName || 'Unknown Place';

    // Photo
    let photoHtml = '';
    if (place.photos && place.photos.length > 0) {
        const photoUrl = place.photos[0].getURI({ maxWidth: 600 });
        photoHtml = `<img src="${photoUrl}" class="place-detail-photo" alt="${place.displayName}">`;
    }

    // Price level (Calculate first)
    let priceSpan = '';
    if (place.priceLevel !== undefined && place.priceLevel !== null) {
        const priceMap = {
            'PRICE_LEVEL_FREE': 'Free',
            'PRICE_LEVEL_INEXPENSIVE': '$',
            'PRICE_LEVEL_MODERATE': '$$',
            'PRICE_LEVEL_EXPENSIVE': '$$$',
            'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$',
            'FREE': 'Free',
            'INEXPENSIVE': '$',
            'MODERATE': '$$',
            'EXPENSIVE': '$$$',
            'VERY_EXPENSIVE': '$$$$',
            0: 'Free',
            1: '$',
            2: '$$',
            3: '$$$',
            4: '$$$$'
        };
        const priceLabel = priceMap[place.priceLevel] || place.priceLevel;
        priceSpan = `<span style="background: var(--secondary); color: var(--primary); padding: 2px 8px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; display: inline-block;">${priceLabel}</span>`;
    }

    // Rating stars
    let ratingHtml = '<span style="color: var(--text-subtle);">No rating</span>';
    if (place.rating) {
        const fullStars = Math.floor(place.rating);
        const hasHalf = place.rating % 1 >= 0.25;
        // Adjusted vertical-align to middle and added a small top margin to the half star container if needed, 
        // but 'middle' usually aligns symbols better with text.
        const starsHtml = '★'.repeat(fullStars)
            + (hasHalf ? '<span style="display:inline-block;overflow:hidden;width:0.5em;">★</span>' : '');
        const reviewCount = place.userRatingCount || 0;

        // Use a flex container for the rating row to ensure perfect vertical alignment
        ratingHtml = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; white-space: nowrap;">
                ${priceSpan}
                <div style="display: inline-flex; align-items: center; color: #f59e0b; font-size: 1.2rem; line-height: 1; flex-shrink: 0;">
                    ${'★'.repeat(fullStars)}
                    ${hasHalf ? '<span style="display:inline-block; overflow:hidden; width:0.5em; flex-shrink: 0;">★</span>' : ''}
                </div>
                <span style="color: var(--text-main); font-weight: 600; font-size: 1.1rem; line-height: 1; flex-shrink: 0; margin-left: 2px;">${place.rating}</span>
            </div>
            <div style="color: var(--text-subtle); font-size: 0.9rem; margin-bottom: 8px;">(${reviewCount} reviews)</div>
        `;
    } else if (priceSpan) {
        ratingHtml = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                ${priceSpan}
                <span style="color: var(--text-subtle); font-size: 0.9rem;">No rating</span>
            </div>
        `;
    }

    // Price level (Merged into ratingHtml, keeping variable empty to prevent errors)
    let priceHtml = '';

    // Open/Closed status
    let hoursHtml = '';
    if (place.regularOpeningHours) {
        const isOpen = place.regularOpeningHours.isOpen?.() ?? null;
        if (isOpen !== null) {
            hoursHtml = isOpen
                ? '<span style="color: #16a34a; font-weight: 600;">🟢 Open now</span>'
                : '<span style="color: #dc2626; font-weight: 600;">🔴 Closed</span>';
        }
        if (place.regularOpeningHours.weekdayDescriptions) {
            const todayIndex = new Date().getDay();
            const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun mapping
            const todayHours = place.regularOpeningHours.weekdayDescriptions[dayOrder.indexOf(todayIndex)] || '';
            if (todayHours) {
                hoursHtml += ` <span style="color: var(--text-subtle); font-size: 0.85rem;">· ${todayHours}</span>`;
            }
        }
    }

    // Contact info
    let contactHtml = '';
    if (place.nationalPhoneNumber) {
        contactHtml += `<div style="margin-bottom: 6px;">📞 <a href="tel:${place.nationalPhoneNumber}" style="color: var(--primary);">${place.nationalPhoneNumber}</a></div>`;
    }
    if (place.websiteURI) {
        const domain = new URL(place.websiteURI).hostname.replace('www.', '');
        contactHtml += `<div style="margin-bottom: 6px;">🌐 <a href="${place.websiteURI}" target="_blank" style="color: var(--primary);">${domain}</a></div>`;
    }

    // Travel times
    let travelHtml = '<div class="place-detail-travel">';
    if (item.times && item.times.length > 0) {
        // Count friends to handle numbering
        const friendCount = item.times.filter(t => t.type === 'FRIEND').length;

        item.times.forEach(t => {
            let icon = '📍';
            if (t.type === 'YOU') icon = '👤';
            else if (t.type === 'FRIEND') icon = '👥';

            // Shorten label for modal
            let displayLabel = t.label;
            if (displayLabel.includes('starting point')) {
                displayLabel = displayLabel.replace("'s starting point", "");
                // Handle "friend" vs "friend 1"
                if (displayLabel.toLowerCase().trim() === 'friend') {
                    displayLabel = (friendCount > 1) ? 'Friend 1' : 'Friend';
                }
            }
            if (t.type === 'YOU') displayLabel = 'You';

            const dirModeMap = { 'DRIVING': 'driving', 'TRANSIT': 'transit', 'WALKING': 'walking', 'BICYCLING': 'bicycling' };
            const dirMode = dirModeMap[t.mode] || 'driving';
            const originStr = `${t.origin.lat()},${t.origin.lng()} `;
            const destStr = `${place.location.lat()},${place.location.lng()} `;
            // Use query format for reliability
            const dirUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}&travelmode=${dirMode}`;

            travelHtml += `
            <div class="place-detail-travel-item">
                <span class="travel-label">${icon} from ${displayLabel.toLowerCase()}</span>
                <span class="travel-time">${t.text}</span>
                <a href="${dirUrl}" target="_blank" class="directions-link" title="Get Directions">
                    <span style="font-size: 0.8rem;">🗺️ directions</span>
                </a>
            </div>`;
        });
    } else {
        travelHtml += '<div style="padding:10px;">Travel times not available</div>';
    }
    travelHtml += '</div>';

    // Google Maps link
    const mapsUrl = place.googleMapsURI || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.displayName + ' ' + (place.formattedAddress || ''))}`;

    // Re-Assemble content
    contentEl.innerHTML = `
        ${photoHtml}
        <div class="place-detail-info">
            <!-- Rating & Reviews Block -->
            ${ratingHtml}
            
            <!-- Price Block -->
            ${priceHtml}

            <!-- Hours Block -->
            ${hoursHtml ? `<div style="margin-bottom: 12px;">${hoursHtml}</div>` : ''}
            
            <!-- Address -->
            <div style="margin-bottom: 12px; color: var(--text-subtle); font-size: 0.95rem;">📍 ${place.formattedAddress || 'Address not available'}</div>
            
            <!-- Contact -->
            ${contactHtml ? `<div style="margin-bottom: 12px;">${contactHtml}</div>` : ''}
            
            <!-- Travel Times -->
            ${travelHtml}
            
            <!-- Actions -->
            <div class="place-detail-actions">
                <a href="${mapsUrl}" target="_blank" class="primary-btn" style="text-decoration: none; text-align: center; display: inline-block; width: auto; padding: 0.6rem 1.2rem; font-size: 0.9rem;">📍 View on Google Maps</a>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
}

function closePlaceDetail() {
    document.getElementById('placeDetailModal').style.display = 'none';
}

window.openPlaceDetail = openPlaceDetail;
window.closePlaceDetail = closePlaceDetail;

// Global scope for the button functionality
window.findMidpoint = findMidpoint;

// Enter Key Shortcuts Helper
function addEnterTrigger(elementId, callback) {
    const el = document.getElementById(elementId);
    if (el) {
        // Use capture: true to catch the event before the web component swallows it
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                callback();
            }
        }, true);
    }
}

// Setup Global Shortcuts and Initialization
function initApp() {
    // Apply saved user preferences to form
    loadUserPreferences();

    // Update auth UI state
    updateAuthUI();

    // Render location chips if logged in
    renderLocationChips();

    // Init custom dropdowns Selection Listeners
    setupCustomDropdowns();

    // Init Autocomplete
    initAutocomplete('placeType', 'placeType-suggestions', placeSuggestions);
    initAutocomplete('prefDefaultType', 'prefDefaultType-suggestions', placeSuggestions);

    // Search Input Shortcuts
    addEnterTrigger('addressA', findMidpoint);
    addEnterTrigger('modeA', findMidpoint);
    addEnterTrigger('addressB', findMidpoint);
    addEnterTrigger('modeB', findMidpoint);
    addEnterTrigger('placeType', findMidpoint);
    addEnterTrigger('sortPreference', findMidpoint);
    addEnterTrigger('departureTime', findMidpoint);

    // Auth Inputs Shortcuts
    addEnterTrigger('authEmail', handleAuth);
    addEnterTrigger('authPassword', handleAuth);
    addEnterTrigger('authFirstName', handleAuth);
    addEnterTrigger('authLastName', handleAuth);

    // Profile/Preferences Shortcuts (Auto-Save Logic)
    // 1. Text Input: Save on Enter and Blur
    const prefTypeInput = document.getElementById('prefDefaultType');
    if (prefTypeInput) {
        addEnterTrigger('prefDefaultType', () => {
            handleSavePreferences();
            prefTypeInput.blur(); // Remove focus after saving
        });
        prefTypeInput.addEventListener('blur', handleSavePreferences);
    }

    // 2. Dropdowns: Save on Change
    // Note: Our custom dropdowns update the underlying <select> and dispatch a 'change' event
    const prefModeSelect = document.getElementById('prefDefaultMode');
    if (prefModeSelect) {
        prefModeSelect.addEventListener('change', handleSavePreferences);
    }

    const prefSortSelect = document.getElementById('prefDefaultSort');
    if (prefSortSelect) {
        prefSortSelect.addEventListener('change', handleSavePreferences);
    }

    // Other shortcuts
    addEnterTrigger('newLocAlias', handleAddLocation);
    addEnterTrigger('newLocAddress', handleAddLocation);

    // Global Keydown Listeners (Escape and Enter)
    window.addEventListener('keydown', (e) => {
        // 1. Enter key logic
        if (e.key === 'Enter') {
            const activeEl = document.activeElement;
            const profileModal = document.getElementById('profileModal');
            const authModal = document.getElementById('authModal');
            const historyModal = document.getElementById('historyModal');

            const isModalOpen = (profileModal && profileModal.style.display === 'flex') ||
                (authModal && authModal.style.display === 'flex') ||
                (historyModal && historyModal.style.display === 'flex');

            if (!['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'GMP-PLACE-AUTOCOMPLETE'].includes(activeEl.tagName) && !isModalOpen) {
                findMidpoint();
            }
        }

        // 2. Escape key logic (Close all modals and dropdowns)
        if (e.key === 'Escape') {
            // Close Modals
            const modals = ['profileModal', 'authModal', 'historyModal', 'placeDetailModal'];
            modals.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            // Close Dropdowns
            document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
        }
    }, true);
}

document.addEventListener('DOMContentLoaded', initApp);

// Branding: Custom Notification System
function showNotification(message, type = 'error', duration = 4000) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    // Prevent duplicate messages from stacking
    const existingToasts = container.querySelectorAll('.toast-content');
    for (const toastText of existingToasts) {
        if (toastText.textContent.trim() === message.toLowerCase().trim()) {
            return; // Already showing this message
        }
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Choose icon based on type
    const icons = {
        'error': '⚠️',
        'info': 'ℹ️',
        'success': '✅'
    };
    const icon = icons[type] || 'ℹ️';

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <div class="toast-content">${message.toLowerCase()}</div>
    `;

    // Click to dismiss
    toast.onclick = () => removeToast(toast);

    container.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => {
        removeToast(toast);
    }, duration);
}

function removeToast(toast) {
    if (toast.classList.contains('removing')) return;
    toast.classList.add('removing');
    // Wait for animation to finish before removing from DOM
    setTimeout(() => {
        toast.remove();
    }, 300);
}

// Custom Dropdown Logic
// Close all autocomplete suggestion dropdowns
function closeAllAutocompleteSuggestions() {
    document.querySelectorAll('.autocomplete-wrapper .dropdown-menu').forEach(list => {
        list.style.opacity = '0';
        list.style.visibility = 'hidden';
        list.style.transform = 'translateY(-10px)';
        setTimeout(() => { if (list.style.visibility === 'hidden') list.innerHTML = ''; }, 300);
    });
}

function toggleDropdown(event) {
    event.stopPropagation();
    const dropdown = event.target.closest('.custom-dropdown');
    document.querySelectorAll('.custom-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.remove('open');
    });
    dropdown.classList.toggle('open');
    // Close any open autocomplete suggestions and datepicker
    closeAllAutocompleteSuggestions();
    const dpDropdown = document.getElementById('datepickerDropdown');
    if (dpDropdown) dpDropdown.classList.remove('dp-open');
}

function selectOption(dropdown, value, text) {
    const trigger = dropdown.querySelector('.dropdown-trigger');
    const nativeSelect = dropdown.querySelector('select');

    // Update native select
    nativeSelect.value = value;
    // Trigger change event for any listeners
    nativeSelect.dispatchEvent(new Event('change'));

    // Update UI
    trigger.textContent = text;
    dropdown.classList.remove('open');

    // Update selected class in menu
    dropdown.querySelectorAll('.dropdown-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === value);
    });
}

// Global click to close dropdowns
window.addEventListener('click', () => {
    document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
});

// Setup custom dropdown observers and click listeners
function setupDropdown(dropdown) {
    const trigger = dropdown.querySelector('.dropdown-trigger');
    const select = dropdown.querySelector('select');
    const options = dropdown.querySelectorAll('.dropdown-option');

    trigger.onclick = (e) => {
        e.stopPropagation();
        // Close others
        document.querySelectorAll('.custom-dropdown').forEach(d => {
            if (d !== dropdown) d.classList.remove('open');
        });
        dropdown.classList.toggle('open');
    };

    options.forEach(opt => {
        opt.onclick = (e) => {
            e.stopPropagation();
            selectOption(dropdown, opt.dataset.value, opt.textContent);
        };
    });
}

function setupCustomDropdowns() {
    document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
        setupDropdown(dropdown);
    });
}

// setup is now handled in initApp


// Update applyPreferences to work with custom dropdowns
const originalApplyPreferences = window.applyPreferences;
function applyPreferences() {
    const user = AuthService.getCurrentUser();
    if (!user || !user.preferences) return;

    const prefs = user.preferences;

    // Helper to sync custom UI with native select values
    const syncDropdown = (id, value) => {
        const select = document.getElementById(id);
        if (select) {
            select.value = value || "";
            const dropdown = select.closest('.custom-dropdown');
            if (dropdown) {
                const trigger = dropdown.querySelector('.dropdown-trigger');
                const selectedOpt = dropdown.querySelector(`.dropdown-option[data-value="${value || ''}"]`);
                if (selectedOpt && trigger) {
                    trigger.textContent = selectedOpt.textContent;
                    dropdown.querySelectorAll('.dropdown-option').forEach(opt => {
                        opt.classList.toggle('selected', opt.dataset.value === (value || ''));
                    });
                }
            }
        }
    };

    syncDropdown('modeA', prefs.defaultMode);

    syncDropdown('prefDefaultMode', prefs.defaultMode);
    syncDropdown('sortPreference', prefs.defaultSort);
    syncDropdown('prefDefaultSort', prefs.defaultSort);

    if (prefs.defaultType) {
        const typeInput = document.getElementById('placeType');
        const prefTypeInput = document.getElementById('prefDefaultType');
        if (typeInput) typeInput.value = (prefs.defaultType).toLowerCase();
        if (prefTypeInput) prefTypeInput.value = (prefs.defaultType).toLowerCase();
    }
}
window.loadUserPreferences = loadUserPreferences;

window.showNotification = showNotification;


// --- Multi-User Logic ---
let friendIdCounter = 1; // Unique ID generator
const MAX_TOTAL_PEOPLE = 5; // You + 4 Friends
let friendPlaces = {}; // Store Place objects for dynamic inputs

function addFriendInput() {
    const currentCount = document.querySelectorAll('#friends-container .friend-group').length;

    // Limit to 4 friends (Total 5 people including You)
    if (currentCount >= (MAX_TOTAL_PEOPLE - 1)) {
        showNotification("Maximum 5 people allowed (You + 4 Friends).");
        const btn = document.getElementById('addFriendBtn');
        if (btn) btn.style.display = 'none';
        return;
    }

    friendIdCounter++;
    const container = document.getElementById('friends-container');
    const newIndex = friendIdCounter; // Use counter for unique ID
    const newId = `friend-group-${newIndex}`;

    const div = document.createElement('div');
    div.className = 'input-group friend-group';
    div.id = newId;
    div.style.position = 'relative';

    // Hide add button if limit reached (currentCount + 1 will be new count)
    if (currentCount + 1 >= (MAX_TOTAL_PEOPLE - 1)) {
        const btn = document.getElementById('addFriendBtn');
        if (btn) btn.style.display = 'none';
    }

    // Update Friend 1 label if getting > 1 person (You + Friend 1 is 2 people, so always > 1? No, > 1 friend group which is Friend 1)
    // Actually Logic: If we have > 1 'friend-group' divs.
    // Yes.

    // We update labels at the end anyway.

    div.innerHTML = `
        <label>
            <span class="label-icon" style="color: #6a8e4e;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                    stroke-linejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
            </span>
            <span class="friend-label-text">friend ${newIndex}'s starting point</span> <span class="required">*</span>
            <button type="button" class="remove-friend-btn" onclick="removeFriend('${newId}')">
                ✕
            </button>
        </label>
        <gmp-place-autocomplete id="address-friend-${newIndex}" class="friend-address" placeholder="Enter start address"></gmp-place-autocomplete>
        <div id="chips-friend-${newIndex}"></div>
        <div class="custom-dropdown" data-id="mode-friend-${newIndex}">
            <button class="dropdown-trigger" onclick="toggleDropdown(event)">select mode of transportation</button>
            <div class="dropdown-menu">
                <div class="dropdown-option" data-value="DRIVING">🚗 driving</div>
                <div class="dropdown-option" data-value="TRANSIT">🚍 public transit</div>
                <div class="dropdown-option" data-value="WALKING">🚶 walking</div>
                <div class="dropdown-option" data-value="BICYCLING">🚲 biking</div>
            </div>
            <select id="mode-friend-${newIndex}" class="friend-mode">
                <option value="">select mode of transportation</option>
                <option value="DRIVING">🚗 driving</option>
                <option value="TRANSIT">🚍 public transit</option>
                <option value="WALKING">🚶 walking</option>
                <option value="BICYCLING">🚲 biking</option>
            </select>
        </div>
    `;

    container.appendChild(div);

    // Initializers
    const addressId = `address-friend-${newIndex}`;
    const modeId = `mode-friend-${newIndex}`;

    // Autocomplete listener
    const input = document.getElementById(addressId);
    input.addEventListener('gmp-places-place-select', (event) => {
        friendPlaces[addressId] = event.detail.place;
    });

    // Add Enter trigger
    addEnterTrigger(addressId, findMidpoint);

    // Setup Dropdown
    const dropdown = div.querySelector('.custom-dropdown');
    setupDropdown(dropdown);

    // Sync default mode if available


    updateFriendLabels();
}

function removeFriend(id) {
    const el = document.getElementById(id);
    if (el) el.remove();

    // Count active friends (excluding fixed Friend 1)
    const groups = document.querySelectorAll('#friends-container .friend-group');
    const totalFriends = groups.length; // Friend 1 is included in this count? 
    // Wait, friend-group-0 is inside friends-container?
    // Let's check HTML.
    // friend-group-0 is NOT inside #friends-container based on previous edits?
    // In step 1, I wrapped "Friend's starting point" in #friends-container?
    // Let me check index.html to be sure.
    // If friend-group-0 is inside, then length is total.
    // If not, length is just dynamic friends.
    // Step 1 summary: "Wrapped the 'Friend's starting point' (Location B) input group in a <div id='friends-container'>".
    // So YES, friend-group-0 IS inside.

    // If total < MAX_FRIENDS + 1 (You + 4 friends = 5 locations. MAX_FRIENDS=4 additional friends?
    // No, MAX_FRIENDS=4 means 4 *additional*? Or 4 friends total?
    // User said "up to 5 total locations". You + 4 friends.
    // So total friends = 4.
    // If groups.length < 4, show button.

    if (groups.length < 4) {
        const btn = document.getElementById('addFriendBtn');
        if (btn) btn.style.display = 'block';
    }

    updateFriendLabels();
}

function updateFriendLabels() {
    const groups = document.querySelectorAll('#friends-container .friend-group');
    let count = 0;

    groups.forEach((group) => {
        count++; // 1-based index

        if (group.id === 'friend-group-0') {
            // Friend 1
            const label = group.querySelector('label');
            const labelText = groups.length > 1 ? "friend 1's starting point" : "friend's starting point";

            // Replace text node safely
            for (let node of label.childNodes) {
                if (node.nodeType === 3 && node.textContent.includes('starting point')) {
                    node.textContent = ` ${labelText} `; // preserve spacing
                    break;
                }
            }
        } else {
            // Dynamic friends
            const labelSpan = group.querySelector('.friend-label-text');
            if (labelSpan) labelSpan.textContent = `friend ${count}'s starting point`;
        }
    });
}

function getAllLocations() {
    const locs = [];

    // 1. You (Location A)
    const elA = document.getElementById('addressA');
    if (!elA || !elA.value) {
        showNotification("Please enter your starting location.");
        return null;
    }
    locs.push({
        type: 'YOU',
        label: 'Your starting point',
        address: elA.value,
        mode: document.getElementById('modeA').value,
        place: selectedPlaceA
    });


    // 2. Friend 1 (Location B - Fixed)
    const elB = document.getElementById('addressB');
    const friendGroups = document.querySelectorAll('#friends-container .friend-group');
    if (!elB || !elB.value) {
        showNotification("Please enter friend's starting location.");
        return null; // Return null to indicate validation failure
    }
    locs.push({
        type: 'FRIEND',
        label: friendGroups.length > 1 ? "friend 1's starting point" : "friend's starting point",
        address: elB.value,
        mode: document.getElementById('modeB').value,
        place: selectedPlaceB // Global var
    });


    // 3. Dynamic Friends
    const groups = document.querySelectorAll('#friends-container .friend-group');
    let dynamicError = false;
    groups.forEach(group => {
        if (group.id === 'friend-group-0') return; // Handled above

        const addrInput = group.querySelector('.friend-address');
        const modeInput = group.querySelector('.friend-mode');
        const labelText = group.querySelector('.friend-label-text')?.textContent || "Friend";

        if (!addrInput || !addrInput.value) {
            showNotification(`Please enter the starting point for ${labelText}.`);
            dynamicError = true;
            return;
        }

        locs.push({
            type: 'FRIEND',
            label: labelText,
            address: addrInput.value,
            mode: modeInput.value,
            place: friendPlaces[addrInput.id]
        });
    });

    if (dynamicError) return null;

    return locs;
}

window.toggleDropdown = toggleDropdown;
window.removeFriend = removeFriend;
window.addFriendInput = addFriendInput;
document.getElementById('addFriendBtn').addEventListener('click', addFriendInput);



// --- Star Rating Component Logic ---

// SVG Constants
const STAR_EMPTY = `<svg viewBox="0 0 24 24" fill="none" class="star-svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#e5e7eb"/></svg>`;
const STAR_HALF = `<svg viewBox="0 0 24 24" fill="none" class="star-svg"><defs><linearGradient id="halfGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="50%" stop-color="#f59e0b"/><stop offset="50%" stop-color="#e5e7eb"/></linearGradient></defs><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="url(#halfGrad)"/></svg>`;
const STAR_FULL = `<svg viewBox="0 0 24 24" fill="none" class="star-svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#f59e0b"/></svg>`;

function renderStars(containerId, value) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const starsDiv = container.querySelector('.stars');
    const valueSpan = container.querySelector('.rating-value');

    // Clear
    starsDiv.innerHTML = '';

    // Loop 1 to 5
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('div');
        star.style.cursor = 'pointer';
        star.style.display = 'flex';
        star.style.alignItems = 'center';
        star.style.width = '24px';
        star.style.height = '24px';
        star.classList.add('star-item');

        // Fill
        if (value >= i) {
            star.innerHTML = STAR_FULL;
        } else if (value > i - 1 && value < i) {
            star.innerHTML = STAR_HALF;
        } else {
            star.innerHTML = STAR_EMPTY;
        }

        // Click Handler (Set Rating)
        star.onclick = (e) => {
            e.stopPropagation();
            const rect = star.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const isHalf = clickX < rect.width / 2;
            const newValue = isHalf ? i - 0.5 : i;

            const input = container.querySelector('input[type="hidden"]');
            const currentValue = parseFloat(input.value);

            // If clicking the current exact value, reset to 0 (toggle off/any)
            if (currentValue === newValue) {
                input.value = 0;
            } else {
                input.value = newValue;
            }

            renderStars(containerId, parseFloat(input.value));
        };

        starsDiv.appendChild(star);
    }

    // Update text
    if (value === 0) valueSpan.textContent = 'any';
    else valueSpan.textContent = value + '+';
}

// Price Selector Logic
function renderPriceSelector(containerId, value) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const pricesDiv = container.querySelector('.prices');
    const valueSpan = container.querySelector('.price-value');
    const input = container.querySelector('input[type="hidden"]');

    if (!pricesDiv || !input) return;

    pricesDiv.innerHTML = '';
    input.value = value; // Sync input

    const priceLabels = ['Free', 'Inexpensive', 'Moderate', 'Expensive', 'Very Expensive'];
    // indices: 0=free (not used in filter usually?), 1=$, 2=$$, 3=$$$, 4=$$$$

    // Create 4 dollar signs
    for (let i = 1; i <= 4; i++) {
        const symbol = document.createElement('span');
        symbol.className = 'price-symbol';
        symbol.textContent = '$';

        // Active state: If selected is 3 ($$$), then $, $$, $$$ should be active?
        // "Max Price" logic: Yes.
        if (i <= value) {
            symbol.classList.add('active');
        }

        symbol.onclick = (e) => {
            e.stopPropagation();
            // Toggle off if clicking the exact current max
            if (parseInt(input.value) === i) {
                renderPriceSelector(containerId, 0);
            } else {
                renderPriceSelector(containerId, i);
            }
        };

        pricesDiv.appendChild(symbol);
    }

    // Update Text
    if (value === 0) valueSpan.textContent = 'any';
    else {
        // "Up to $$"
        valueSpan.textContent = '$'.repeat(value);
        // Or text like "max $$"
    }
}

// Expose
window.renderStars = renderStars;
window.renderPriceSelector = renderPriceSelector;

function initStarRating(containerId, inputId, onChangeCallback) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    const starsDiv = container.querySelector('.stars');

    if (!container || !input || !starsDiv) return;

    // Initial Render
    renderStars(containerId, parseFloat(input.value) || 0);

    // Mouse Interactions
    starsDiv.addEventListener('mousemove', (e) => {
        const reqRect = starsDiv.getBoundingClientRect();
        // Check if mouse is within the general stars area
        const x = e.clientX - reqRect.left;

        // Calculate rough value based on 5 stars
        // Total stars width is 24*5 + 2*4 gap approx = 120 + 8 = 128
        // Let's rely on simple division of 5 zones
        if (x < 0) return;

        // Exact calculation: find which star we are over
        const starWidth = 24 + 2; // width + gap
        const rawStar = x / starWidth;

        // Clamp 0 to 5
        let hoverValue = Math.min(5, Math.max(0, rawStar));

        // Snap to 0.5
        hoverValue = Math.ceil(hoverValue * 2) / 2;

        // Limit min to 0
        if (hoverValue < 0) hoverValue = 0;

        renderStars(containerId, hoverValue);
        const valSpan = container.querySelector('.rating-value');
        if (valSpan) valSpan.style.opacity = '0.7'; // Indicate preview
    });

    starsDiv.addEventListener('mouseleave', () => {
        // Reset to stored value
        renderStars(containerId, parseFloat(input.value) || 0);
        const valSpan = container.querySelector('.rating-value');
        if (valSpan) valSpan.style.opacity = '1';
    });

    starsDiv.addEventListener('click', (e) => {
        // Calculate value same way as hover
        const reqRect = starsDiv.getBoundingClientRect();
        const x = e.clientX - reqRect.left;
        const starWidth = 26;
        const rawStar = x / starWidth;
        let newValue = Math.ceil(rawStar * 2) / 2;
        newValue = Math.min(5, Math.max(0, newValue));

        // Toggle Logic: If clicking the same value, reset to 0
        const currentValue = parseFloat(input.value) || 0;
        if (newValue === currentValue) {
            newValue = 0;
        }

        // Update Input
        input.value = newValue;

        // Update UI (Mouseleave handles visual reset to new value, but let's force it now)
        renderStars(containerId, newValue);
        const valSpan = container.querySelector('.rating-value');
        if (valSpan) valSpan.style.opacity = '1';

        // Callback (Auto-Save or Search Trigger?)
        if (onChangeCallback) onChangeCallback(newValue);
    });
}

// Initialize Logic
function initRateComponents() {
    // Search Form
    initStarRating('starRatingSearch', 'minRating', (val) => {
        // Optional: Trigger search immediately? Or wait for 'Find Midpoint'?
        // The plan didn't specify auto-search, but inputs usually do. 
        // Let's stick to standard behavior: just update state.
    });

    // Preferences Form
    initStarRating('starRatingPref', 'prefDefaultRating', (val) => {
        // Trigger Auto-Save
        handleSavePreferences();
    });

    // Price Selector (Search Form)
    renderPriceSelector('priceRatingSearch', 0);
}

// Add initialization to DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initRateComponents();
});

// --- Custom Place Type Autocomplete ---
const placeSuggestions = [
    // Food & Drink
    'coffee shop', 'restaurant', 'bar', 'bakery', 'ice cream', 'café',
    'pizza', 'sushi', 'brunch', 'dessert', 'bubble tea', 'food truck',
    'diner', 'fast food', 'steakhouse', 'seafood', 'vegan restaurant',
    'tapas', 'ramen',
    // Entertainment & Nightlife
    'movie theater', 'bowling alley', 'arcade', 'karaoke', 'nightclub',
    'comedy club', 'escape room', 'mini golf', 'laser tag', 'casino',
    'concert venue',
    // Fitness & Outdoors
    'gym', 'park', 'hike', 'yoga studio', 'swimming pool',
    'rock climbing', 'dog park', 'botanical garden', 'beach',
    'skate park', 'tennis court', 'golf course',
    // Shopping & Services
    'shopping mall', 'bookstore', 'thrift store', 'farmers market',
    'nail salon', 'hair salon', 'spa', 'laundromat', 'pharmacy',
    // Culture & Education
    'museum', 'library', 'art gallery', 'aquarium', 'zoo',
    'planetarium', 'theater', 'historic landmark',
    // Casual Hangouts
    'coworking space', 'juice bar', 'hookah lounge',
    'board game café', 'wine bar', 'brewery', 'distillery'
].map(v => ({ value: v, icon: '' }));

function initAutocomplete(inputId, suggestionsId, data) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(suggestionsId);

    if (!input || !list) return;

    const closeList = () => {
        list.style.opacity = '0';
        list.style.visibility = 'hidden';
        list.style.transform = 'translateY(-10px)';
        setTimeout(() => { if (list.style.visibility === 'hidden') list.innerHTML = ''; }, 300);
    };

    const render = (query) => {
        if (!query) { closeList(); return; }

        const lower = query.toLowerCase();
        const matches = data.filter(item => item.value.toLowerCase().startsWith(lower));

        list.innerHTML = '';
        if (matches.length > 0) {
            matches.forEach(item => {
                const div = document.createElement('div');
                div.className = 'dropdown-option';
                div.innerHTML = item.value;
                div.addEventListener('click', () => {
                    input.value = item.value;
                    closeList();
                    input.dispatchEvent(new Event('input'));
                    if (inputId === 'prefDefaultType') handleSavePreferences();
                });
                list.appendChild(div);
            });
            list.style.opacity = '1';
            list.style.visibility = 'visible';
            list.style.transform = 'translateY(0)';
        } else {
            closeList();
        }
    };

    input.addEventListener('input', (e) => { render(e.target.value); });
    input.addEventListener('focus', (e) => {
        // Close all custom dropdowns and datepicker when autocomplete gains focus
        document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
        const dpDropdown = document.getElementById('datepickerDropdown');
        if (dpDropdown) dpDropdown.classList.remove('dp-open');
        if (input.value) render(input.value);
    });

    document.addEventListener('click', (e) => {
        const wrapper = input.parentElement;
        if (wrapper && !wrapper.contains(e.target)) closeList();
    });
}

// --- Custom Date/Time Picker ---
let dpCurrentMonth = new Date().getMonth();
let dpCurrentYear = new Date().getFullYear();
let dpSelectedDate = null;

const dpMonthNames = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];

function initDatepicker() {
    // Populate hour options (1-12)
    const hourSel = document.getElementById('dpHour');
    const minSel = document.getElementById('dpMinute');
    const ampmSel = document.getElementById('dpAmPm');
    if (!hourSel || !minSel) return;

    for (let h = 1; h <= 12; h++) {
        const opt = document.createElement('option');
        opt.value = h;
        opt.textContent = h.toString().padStart(2, '0');
        hourSel.appendChild(opt);
    }

    // Populate minute options (00-59)
    for (let m = 0; m <= 59; m++) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m.toString().padStart(2, '0');
        minSel.appendChild(opt);
    }

    // Populate minute options (00-59)
    for (let m = 0; m <= 59; m++) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m.toString().padStart(2, '0');
        minSel.appendChild(opt);
    }

    // Do not auto-populate on load.
    // Initialization happens on first click.
}

function dpRenderCalendar() {
    const grid = document.getElementById('dpGrid');
    const label = document.getElementById('dpMonthYear');
    if (!grid || !label) return;

    label.textContent = `${dpMonthNames[dpCurrentMonth]} ${dpCurrentYear}`;
    grid.innerHTML = '';

    const firstDay = new Date(dpCurrentYear, dpCurrentMonth, 1).getDay();
    const daysInMonth = new Date(dpCurrentYear, dpCurrentMonth + 1, 0).getDate();
    const daysInPrev = new Date(dpCurrentYear, dpCurrentMonth, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dp-day other-month';
        btn.textContent = daysInPrev - i;
        grid.appendChild(btn);
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dp-day';

        const thisDate = new Date(dpCurrentYear, dpCurrentMonth, d);
        thisDate.setHours(0, 0, 0, 0);

        // Past dates
        if (thisDate < today) {
            btn.classList.add('past');
        }

        // Today
        if (thisDate.getTime() === today.getTime()) {
            btn.classList.add('today');
        }

        // Selected
        if (dpSelectedDate &&
            dpSelectedDate.getDate() === d &&
            dpSelectedDate.getMonth() === dpCurrentMonth &&
            dpSelectedDate.getFullYear() === dpCurrentYear) {
            btn.classList.add('selected');
        }

        btn.textContent = d;
        btn.addEventListener('click', () => {
            if (thisDate < today) return;
            dpSelectedDate = new Date(dpCurrentYear, dpCurrentMonth, d);
            dpRenderCalendar();
            dpUpdateValue();
        });
        grid.appendChild(btn);
    }

    // Next month leading days
    const totalCells = firstDay + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dp-day other-month';
        btn.textContent = i;
        grid.appendChild(btn);
    }
}

function dpNavigate(direction) {
    dpCurrentMonth += direction;
    if (dpCurrentMonth > 11) { dpCurrentMonth = 0; dpCurrentYear++; }
    if (dpCurrentMonth < 0) { dpCurrentMonth = 11; dpCurrentYear--; }
    dpRenderCalendar();
}

function dpUpdateValue() {
    if (!dpSelectedDate) return;

    const hourSel = document.getElementById('dpHour');
    const minSel = document.getElementById('dpMinute');
    const ampmSel = document.getElementById('dpAmPm');
    const display = document.getElementById('datepickerDisplay');
    const clearBtn = document.getElementById('datepickerClear');
    const hiddenInput = document.getElementById('departureTime');

    let hour = parseInt(hourSel.value);
    const minute = parseInt(minSel.value);
    const ampm = ampmSel.value;

    // Convert to 24h for the hidden input value
    let hour24 = hour;
    if (ampm === 'AM' && hour === 12) hour24 = 0;
    if (ampm === 'PM' && hour !== 12) hour24 = hour + 12;

    // Format ISO value for hidden input (used by the search logic)
    const y = dpSelectedDate.getFullYear();
    const m = (dpSelectedDate.getMonth() + 1).toString().padStart(2, '0');
    const d = dpSelectedDate.getDate().toString().padStart(2, '0');
    const hh = hour24.toString().padStart(2, '0');
    const mm = minute.toString().padStart(2, '0');
    hiddenInput.value = `${y}-${m}-${d}T${hh}:${mm}`;

    // Format display text
    const monthShort = dpMonthNames[dpSelectedDate.getMonth()].slice(0, 3);
    const dayNum = dpSelectedDate.getDate();
    const displayHour = hour.toString().padStart(2, '0');
    const displayMin = minute.toString().padStart(2, '0');
    display.textContent = `${monthShort} ${dayNum}, ${y} at ${displayHour}:${displayMin} ${ampm.toLowerCase()}`;

    clearBtn.style.display = 'inline';
}

function toggleDatepicker(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('datepickerDropdown');

    // Close other dropdowns and autocomplete
    document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
    closeAllAutocompleteSuggestions();

    dropdown.classList.toggle('dp-open');

    // Auto-populate with fresh current time if empty
    if (dropdown.classList.contains('dp-open') && !dpSelectedDate) {
        const now = new Date();
        dpSelectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dpCurrentMonth = now.getMonth();
        dpCurrentYear = now.getFullYear();

        // Set selectors to current time
        const hourSel = document.getElementById('dpHour');
        const minSel = document.getElementById('dpMinute');
        const ampmSel = document.getElementById('dpAmPm');

        let hours24 = now.getHours();
        let mins = now.getMinutes();
        const ampm = hours24 >= 12 ? 'PM' : 'AM';
        let hours12 = hours24 % 12;
        if (hours12 === 0) hours12 = 12;

        if (hourSel) hourSel.value = hours12;
        if (minSel) minSel.value = mins;
        if (ampmSel) ampmSel.value = ampm;

        dpRenderCalendar();
        // Do not update the input value/display yet.
        // User must interact to set the value.
    }
}

function clearDatepicker(event) {
    event.stopPropagation();
    dpSelectedDate = null;
    document.getElementById('departureTime').value = '';
    document.getElementById('datepickerDisplay').textContent = 'select date & time';
    document.getElementById('datepickerClear').style.display = 'none';
    dpRenderCalendar();
}

// Close datepicker on outside click
window.addEventListener('click', (e) => {
    const wrapper = document.getElementById('datepickerWrapper');
    const dropdown = document.getElementById('datepickerDropdown');
    if (wrapper && dropdown && !wrapper.contains(e.target)) {
        dropdown.classList.remove('dp-open');
    }
});

// Also close datepicker when custom dropdowns or autocomplete opens
const origToggleDropdown = window.toggleDropdown;
window.toggleDropdown = function (event) {
    const dropdown = document.getElementById('datepickerDropdown');
    if (dropdown) dropdown.classList.remove('dp-open');
    origToggleDropdown(event);
};

// Expose functions globally
window.toggleDatepicker = toggleDatepicker;
window.clearDatepicker = clearDatepicker;
window.dpNavigate = dpNavigate;
window.dpUpdateValue = dpUpdateValue;

// Init datepicker on load
document.addEventListener('DOMContentLoaded', initDatepicker);

// (End of File)
