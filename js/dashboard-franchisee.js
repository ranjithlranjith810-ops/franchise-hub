let discoverSearchTimer = null;

window.discoverSearch = async function() {
  const input = document.getElementById('discoverQ');
  const q = input ? input.value : '';
  const industry = document.getElementById('filterIndustry')?.value || '';
  const minInv = document.getElementById('filterMinInv')?.value || '';
  const maxInv = document.getElementById('filterMaxInv')?.value || '';
  const location = document.getElementById('filterLocation')?.value || '';
  const veteran = document.getElementById('filterVeteran')?.checked || false;
  const sort = document.getElementById('filterSort')?.value || '';
  const page = document.getElementById('discoverPage')?.dataset?.page || 1;

  const params = {};
  if (q) params.q = q;
  if (industry) params.industry = industry;
  if (minInv) params.min_investment = minInv;
  if (maxInv) params.max_investment = maxInv;
  if (location) params.location = location;
  if (veteran) params.veteran = 'true';
  if (sort) params.sort = sort;
  params.page = page;
  params.limit = 12;

  const grid = document.getElementById('discoverGrid');
  const pagination = document.getElementById('discoverPagination');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-state" style="grid-column:1/-1;min-height:200px;"><div class="spinner"></div></div>';

  try {
    const data = await api.searchListings(params);
    if (!data.listings || !data.listings.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><span class="empty-icon">🔍</span><p>No listings found matching your criteria.</p></div>';
      if (pagination) pagination.innerHTML = '';
      return;
    }
    grid.innerHTML = data.listings.map(l => {
      const brand = l.franchiseBrand || l.brand || {};
      const territory = l.territory || {};
      const loc = [territory.city, territory.stateProvince].filter(Boolean).join(', ');
      const industryName = brand.industry?.name || brand.industry || '';
      return `
        <div class="listing-card" onclick="App.navigate('listing-detail','${l.id}')">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <h4>${App.escapeHtml(l.title)}</h4>
            <span class="save-heart" onclick="event.stopPropagation();toggleDiscoverSave('${l.id}')" style="cursor:pointer;font-size:18px;color:var(--text-muted);">${l.isSaved ? '❤️' : '🤍'}</span>
          </div>
          <div class="listing-meta">${App.escapeHtml(brand.name || '')}${loc ? ' · ' + App.escapeHtml(loc) : ''}</div>
          <div class="listing-tags">
            ${industryName ? `<span class="tag">${App.escapeHtml(industryName)}</span>` : ''}
            ${l.investmentMin || l.investmentMax ? `<span class="tag">${App.formatCurrency(l.investmentMin)} - ${App.formatCurrency(l.investmentMax)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    if (pagination) {
      pagination.innerHTML = renderPagination(data.page, data.totalPages, data.total);
    }
  } catch (err) {
    grid.innerHTML = `<div class="error-state" style="grid-column:1/-1;"><p>${App.escapeHtml(err.message)}</p><button class="btn btn-sm btn-primary" onclick="discoverSearch()">Retry</button></div>`;
  }
};

function renderPagination(page, totalPages, total) {
  if (!totalPages || totalPages <= 1) return '';
  let html = `<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:20px;flex-wrap:wrap;">`;
  html += `<span style="font-size:13px;color:var(--text-muted);margin-right:8px;">${total} results</span>`;
  if (page > 1) html += `<button class="btn btn-sm btn-outline" onclick="goDiscoverPage(${page - 1})">Prev</button>`;
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
    html += `<button class="btn btn-sm ${i === page ? 'btn-primary' : 'btn-outline'}" onclick="goDiscoverPage(${i})">${i}</button>`;
  }
  if (page < totalPages) html += `<button class="btn btn-sm btn-outline" onclick="goDiscoverPage(${page + 1})">Next</button>`;
  html += `</div>`;
  return html;
}

window.goDiscoverPage = function(page) {
  const p = document.getElementById('discoverPagination');
  if (p) p.dataset.page = page;
  discoverSearch();
};

window.toggleDiscoverSave = async function(listingId) {
  try {
    const data = await api.toggleSave(listingId);
    renderToast(data.saved ? 'Saved!' : 'Removed from saved', 'success');
    discoverSearch();
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

async function renderFranchiseeOverview() {
  const p = App.profile || {};
  const s = p.stats || {};
  const user = App.user || {};

  $('pageTitle').innerHTML = `Dashboard <span class="greeting">Welcome back, ${App.escapeHtml(user.firstName || '')}</span>`;

  const completeness = calcProfileCompleteness(p);

  const stats = [
    { label: 'Active Leads', value: s.activeLeads ?? s.activeLeads ?? 0 },
    { label: 'Deals in Progress', value: s.deals ?? s.activeDeals ?? 0 },
    { label: 'Saved Listings', value: s.savedListings ?? s.interests ?? 0 },
    { label: 'Unread Messages', value: s.unreadMessages ?? 0 },
  ];

  let statCards = stats.map(st => `
    <div class="stat-card">
      <div class="stat-label">${st.label}</div>
      <div class="stat-value">${st.value}</div>
    </div>
  `).join('');

  const recentLeads = p.recentLeads || [];
  const recentDeals = p.recentDeals || [];
  const continueItem = recentDeals?.[0] || recentLeads?.[0];
  const recommended = p.recommendedListings || [];

  let continueHtml = '';
  if (continueItem) {
    const title = continueItem.franchiseListing?.title || continueItem.title || 'Item';
    const stage = continueItem.stage || continueItem.status || '';
    continueHtml = `
      <div class="card">
        <div class="card-header"><h3>Continue Where You Left Off</h3></div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:14px;">
            <span style="font-size:32px;">📌</span>
            <div>
              <div style="font-weight:600;">${App.escapeHtml(title)}</div>
              <div style="font-size:13px;color:var(--text-muted);">${stage ? `Stage: ${stage.replace(/_/g, ' ')}` : ''}</div>
            </div>
            <div style="margin-left:auto;">
              <button class="btn btn-sm btn-primary" onclick="App.navigate('pipeline')">View Pipeline</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  let recommendedHtml = '';
  if (recommended.length) {
    recommendedHtml = `
      <div class="card">
        <div class="card-header"><h3>Recommended for You</h3><a href="#" onclick="App.navigate('discover');return false;" class="card-link">View all</a></div>
        <div class="card-body">
          <div class="listing-grid">${recommended.map(l => {
            const brand = l.franchiseBrand || l.brand || {};
            const territory = l.territory || {};
            const loc = [territory.city, territory.stateProvince].filter(Boolean).join(', ');
            return `
              <div class="listing-card" onclick="App.navigate('listing-detail','${l.id}')" style="cursor:pointer;">
                <h4>${App.escapeHtml(l.title)}</h4>
                <div class="listing-meta">${App.escapeHtml(brand.name || '')}${loc ? ' · ' + App.escapeHtml(loc) : ''}</div>
                ${brand.industry ? `<div class="tag">${App.escapeHtml(brand.industry.name || brand.industry)}</div>` : ''}
              </div>
            `;
          }).join('')}</div>
        </div>
      </div>
    `;
  }

  let leadsHtml = '';
  if (recentLeads.length) {
    leadsHtml = `
      <div class="card">
        <div class="card-header"><h3>Recent Leads</h3></div>
        <div class="card-body" style="padding:0;">
          <div class="table-wrap"><table>
            <thead><tr><th>Listing</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>${recentLeads.map(l => `
              <tr>
                <td style="font-weight:600;">${App.escapeHtml(l.franchiseListing?.title || l.title || '-')}</td>
                <td>${renderStatusBadge(l.status || 'new')}</td>
                <td style="color:var(--text-muted);font-size:13px;">${App.daysAgo(l.createdAt)}</td>
              </tr>
            `).join('')}</tbody>
          </table></div>
        </div>
      </div>
    `;
  }

  return `
    <div class="stats-grid">${statCards}</div>
    <div style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="font-size:13px;font-weight:600;color:var(--text-muted);">Profile Completeness</span>
        <span style="font-size:13px;font-weight:700;">${completeness}%</span>
      </div>
      <div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${completeness}%;background:var(--primary);border-radius:3px;transition:width .5s ease;"></div>
      </div>
    </div>
    ${continueHtml}
    ${recommendedHtml}
    ${leadsHtml}
  `;
}

function calcProfileCompleteness(profile) {
  if (!profile) return 0;
  let total = 0;
  let filled = 0;
  const fields = [
    profile.investmentCapacityMin, profile.investmentCapacityMax,
    profile.liquidCapital, profile.netWorth, profile.timeline,
    profile.headline, profile.bio, profile.background,
  ];
  total = fields.length + 2;
  fields.forEach(f => { if (f) filled++; });
  if (profile.interests?.industries?.length) filled++;
  if (profile.interests?.locations?.length) filled++;
  return Math.min(100, Math.round((filled / total) * 100));
}

function renderFranchiseeDiscover() {
  $('pageTitle').innerHTML = 'Discover';

  const industryOptions = [
    'Food & Beverage', 'Retail', 'Health & Fitness', 'Education',
    'Home Services', 'Business Services', 'Hospitality', 'Automotive',
    'Real Estate', 'Technology',
  ];

  const html = `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-body">
        <div style="display:flex;gap:10px;margin-bottom:14px;">
          <input type="text" id="discoverQ" placeholder="Search franchises..." style="flex:1;padding:10px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:14px;" oninput="clearTimeout(discoverSearchTimer);discoverSearchTimer=setTimeout(discoverSearch,400)" />
          <button class="btn btn-primary" onclick="discoverSearch()">Search</button>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;">
          <div>
            <label style="display:block;font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Industry</label>
            <select id="filterIndustry" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:13px;" onchange="discoverSearch()">
              <option value="">All Industries</option>
              ${industryOptions.map(io => `<option value="${io}">${io}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display:block;font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Min Investment</label>
            <input type="number" id="filterMinInv" placeholder="Min $" style="width:100px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:13px;" onchange="discoverSearch()" />
          </div>
          <div>
            <label style="display:block;font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Max Investment</label>
            <input type="number" id="filterMaxInv" placeholder="Max $" style="width:100px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:13px;" onchange="discoverSearch()" />
          </div>
          <div>
            <label style="display:block;font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Location</label>
            <input type="text" id="filterLocation" placeholder="City, State" style="width:130px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:13px;" onchange="discoverSearch()" />
          </div>
          <div style="display:flex;align-items:center;gap:6px;padding-bottom:4px;">
            <input type="checkbox" id="filterVeteran" onchange="discoverSearch()" />
            <label for="filterVeteran" style="font-size:13px;cursor:pointer;">Veteran Discount</label>
          </div>
          <div>
            <label style="display:block;font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Sort</label>
            <select id="filterSort" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:13px;" onchange="discoverSearch()">
              <option value="">Newest</option>
              <option value="investment_asc">Investment: Low to High</option>
              <option value="investment_desc">Investment: High to Low</option>
              <option value="name_asc">Name: A-Z</option>
            </select>
          </div>
        </div>
      </div>
    </div>
    <div class="listing-grid" id="discoverGrid">
      <div class="loading-state" style="grid-column:1/-1;min-height:200px;"><div class="spinner"></div></div>
    </div>
    <div id="discoverPagination" data-page="1"></div>
  `;

  setTimeout(discoverSearch, 50);
  return html;
}

async function renderFranchiseeListingDetail(listingId) {
  $('pageTitle').innerHTML = 'Listing Detail';

  try {
    const data = await api.getListingDetail(listingId);
    const listing = data.listing || {};
    const brand = data.brand || listing.franchiseBrand || {};
    const territories = data.territories || listing.territories || [];
    const reviews = data.reviews || listing.reviews || [];
    const avgRating = data.averageRating || listing.averageRating || 0;
    const isSaved = listing.isSaved || false;
    const terr = listing.territory || {};

    const loc = [terr.city, terr.stateProvince].filter(Boolean).join(', ');

    return `
      <button class="btn btn-sm btn-outline" onclick="App.navigate('discover')" style="margin-bottom:16px;">&larr; Back to Discover</button>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div>
          <div class="card">
            <div class="card-body">
              <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
                <div style="width:56px;height:56px;border-radius:14px;background:var(--primary-dim);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:var(--primary);">
                  ${(brand.name || 'F')[0]}
                </div>
                <div>
                  <h2 style="font-family:'Manrope',sans-serif;font-size:20px;margin-bottom:2px;">${App.escapeHtml(listing.title || '')}</h2>
                  <div style="font-size:14px;color:var(--text-muted);">${App.escapeHtml(brand.name || '')}${brand.industry ? ' · ' + App.escapeHtml(brand.industry.name || brand.industry) : ''}</div>
                </div>
              </div>
              <div class="info-grid">
                ${brand.foundedYear ? `<div class="info-group"><label>Founded</label><div class="value">${brand.foundedYear}</div></div>` : ''}
                ${brand.totalUnits ? `<div class="info-group"><label>Total Units</label><div class="value">${brand.totalUnits}</div></div>` : ''}
                ${loc ? `<div class="info-group"><label>Location</label><div class="value">${App.escapeHtml(loc)}</div></div>` : ''}
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>Investment Snapshot</h3></div>
            <div class="card-body">
              <div class="info-grid">
                <div class="info-group"><label>Franchise Fee</label><div class="value">${App.formatCurrency(listing.franchiseFee)}</div></div>
                <div class="info-group"><label>Royalty %</label><div class="value">${listing.royaltyPercentage || listing.royaltyPercent || '-'}${listing.royaltyPercentage ? '%' : ''}</div></div>
                <div class="info-group"><label>Marketing Fee %</label><div class="value">${listing.marketingFeePercentage || listing.marketingFee || '-'}${listing.marketingFeePercentage ? '%' : ''}</div></div>
                <div class="info-group"><label>Net Worth Req.</label><div class="value">${App.formatCurrency(listing.netWorthRequired || listing.netWorthReq)}</div></div>
                <div class="info-group"><label>Liquid Capital Req.</label><div class="value">${App.formatCurrency(listing.liquidCapitalRequired || listing.liquidCapitalReq)}</div></div>
                <div class="info-group"><label>Investment Range</label><div class="value">${App.formatCurrency(listing.investmentMin)} - ${App.formatCurrency(listing.investmentMax)}</div></div>
              </div>
              ${listing.veteranDiscount ? `<div style="margin-top:12px;"><span class="status-badge active">🇺🇸 Veteran Discount Available</span></div>` : ''}
            </div>
          </div>

          ${listing.description ? `
            <div class="card">
              <div class="card-header"><h3>Description</h3></div>
              <div class="card-body">
                <p style="font-size:14px;line-height:1.7;color:var(--text-muted);">${App.escapeHtml(listing.description)}</p>
              </div>
            </div>
          ` : ''}

          ${territories.length ? `
            <div class="card">
              <div class="card-header"><h3>Available Territories (${territories.length})</h3></div>
              <div class="card-body" style="padding:0;">
                <div class="table-wrap"><table>
                  <thead><tr><th>City</th><th>State</th><th>Status</th></tr></thead>
                  <tbody>${territories.map(t => `
                    <tr>
                      <td>${App.escapeHtml(t.city || '-')}</td>
                      <td>${App.escapeHtml(t.stateProvince || t.state || '-')}</td>
                      <td>${renderStatusBadge(t.status || 'available')}</td>
                    </tr>
                  `).join('')}</tbody>
                </table></div>
              </div>
            </div>
          ` : ''}
        </div>

        <div>
          ${reviews.length ? `
            <div class="card">
              <div class="card-header">
                <h3>Reviews</h3>
                <span style="font-size:14px;color:var(--text-muted);">${avgRating.toFixed(1)} ★ (${reviews.length})</span>
              </div>
              <div class="card-body" style="padding:0;">
                ${reviews.map(r => `
                  <div style="padding:14px 22px;border-bottom:1px solid var(--border);">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                      <span style="font-weight:600;font-size:14px;">${App.escapeHtml(r.user?.firstName || r.user?.name || 'Anonymous')}</span>
                      <span style="font-size:13px;color:#F59E0B;">${'★'.repeat(Math.round(r.rating || 0))}${'☆'.repeat(5 - Math.round(r.rating || 0))}</span>
                    </div>
                    <p style="font-size:13px;color:var(--text-muted);margin:0;">${App.escapeHtml(r.content || r.comment || '')}</p>
                    <span style="font-size:11px;color:var(--text-muted);">${App.daysAgo(r.createdAt)}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : `
            <div class="card">
              <div class="card-body">
                <div class="empty-state"><span class="empty-icon">⭐</span><p>No reviews yet.</p></div>
              </div>
            </div>
          `}

          <div style="display:flex;gap:10px;">
            <button class="btn btn-primary" style="flex:1;" onclick="requestInfoFromDetail('${listingId}')">Request Information</button>
            <button class="btn ${isSaved ? 'btn-danger' : 'btn-outline'}" style="flex:1;" onclick="toggleDetailSave('${listingId}')">${isSaved ? '❤️ Unsave' : '🤍 Save'}</button>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    return `
      <button class="btn btn-sm btn-outline" onclick="App.navigate('discover')" style="margin-bottom:16px;">&larr; Back to Discover</button>
      <div class="error-state">
        <span class="error-icon">⚠️</span>
        <h2>Failed to load listing</h2>
        <p>${App.escapeHtml(err.message)}</p>
        <button class="btn btn-primary" onclick="App.render()">Try Again</button>
      </div>
    `;
  }
}

window.requestInfoFromDetail = async function(listingId) {
  const notes = prompt('Any notes for the franchisor? (optional)');
  try {
    await api.requestInfo(listingId, notes || '');
    renderToast('Information request sent!', 'success');
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

window.toggleDetailSave = async function(listingId) {
  try {
    const data = await api.toggleSave(listingId);
    renderToast(data.saved ? 'Saved!' : 'Removed from saved', 'success');
    App.render();
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

async function renderFranchiseeSaved() {
  $('pageTitle').innerHTML = 'Saved Listings';

  try {
    const data = await api.getSaved();
    const saved = data.saved || [];

    if (!saved.length) {
      return `
        <div class="empty-state">
          <span class="empty-icon">❤️</span>
          <p>You haven't saved any listings yet. Explore franchises and save the ones you like!</p>
          <button class="btn btn-primary" onclick="App.navigate('discover')" style="margin-top:12px;">Discover Listings</button>
        </div>
      `;
    }

    return `
      <div class="listing-grid">
        ${saved.map(item => {
          const listing = item.listing || item.franchiseListing || item;
          const brand = listing.franchiseBrand || listing.brand || {};
          const territory = listing.territory || {};
          const loc = [territory.city, territory.stateProvince].filter(Boolean).join(', ');
          return `
            <div class="listing-card">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <h4>${App.escapeHtml(listing.title || '')}</h4>
                <button class="btn btn-sm btn-danger" onclick="unsaveListing('${listing.id}')" title="Unsave">✕</button>
              </div>
              <div class="listing-meta">${App.escapeHtml(brand.name || '')}${loc ? ' · ' + App.escapeHtml(loc) : ''}</div>
              <div style="margin-top:10px;display:flex;gap:8px;">
                <button class="btn btn-sm btn-primary" onclick="App.navigate('listing-detail','${listing.id}')">View Listing</button>
                <button class="btn btn-sm btn-outline" onclick="requestInfoFromDetail('${listing.id}')">Request Info</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    return `
      <div class="error-state">
        <span class="error-icon">⚠️</span>
        <p>${App.escapeHtml(err.message)}</p>
        <button class="btn btn-primary" onclick="App.render()">Try Again</button>
      </div>
    `;
  }
}

window.unsaveListing = async function(listingId) {
  try {
    await api.toggleSave(listingId);
    renderToast('Removed from saved', 'success');
    App.render();
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

async function renderFranchiseePipeline() {
  $('pageTitle').innerHTML = 'Pipeline';

  try {
    const data = await api.getPipeline();
    const leads = data.leads || [];
    const deals = data.deals || [];

    if (!leads.length && !deals.length) {
      return `
        <div class="empty-state">
          <span class="empty-icon">📈</span>
          <p>Your pipeline is empty. Start by exploring franchise opportunities!</p>
          <button class="btn btn-primary" onclick="App.navigate('discover')" style="margin-top:12px;">Discover Listings</button>
        </div>
      `;
    }

    let html = '';

    if (leads.length) {
      html += `
        <div class="card">
          <div class="card-header"><h3>Active Leads (${leads.length})</h3></div>
          <div class="card-body" style="padding:0;">
            <div class="table-wrap"><table>
              <thead><tr><th>Listing</th><th>Status</th><th>Days</th><th>Action</th></tr></thead>
              <tbody>${leads.map(l => {
                const days = l.createdAt ? Math.floor((new Date() - new Date(l.createdAt)) / (1000 * 60 * 60 * 24)) : 0;
                return `
                  <tr>
                    <td style="font-weight:600;">${App.escapeHtml(l.franchiseListing?.title || l.listing?.title || '-')}</td>
                    <td>${renderStatusBadge(l.status || 'new')}</td>
                    <td style="color:var(--text-muted);font-size:13px;">${days}d</td>
                    <td><button class="btn btn-sm btn-primary" onclick="App.navigate('messages')">Contact</button></td>
                  </tr>
                `;
              }).join('')}</tbody>
            </table></div>
          </div>
        </div>
      `;
    }

    if (deals.length) {
      html += `
        <div class="card">
          <div class="card-header"><h3>Active Deals (${deals.length})</h3></div>
          <div class="card-body">
            ${deals.map(d => {
              const stages = ['inquiry', 'discovery', 'fdd_review', 'discovery_day', 'item_23_call', 'agreement_sent', 'signed', 'closed_won'];
              const currentIdx = stages.indexOf(d.stage);
              const days = d.createdAt ? Math.floor((new Date() - new Date(d.createdAt)) / (1000 * 60 * 60 * 24)) : 0;
              return `
                <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--border);">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div>
                      <div style="font-weight:600;">${App.escapeHtml(d.franchiseListing?.title || d.listing?.title || 'Deal')}</div>
                      <div style="font-size:13px;color:var(--text-muted);">${App.escapeHtml(d.franchiseBrand?.name || d.brand?.name || '')} · ${days}d in pipeline</div>
                    </div>
                    <div style="font-size:13px;font-weight:600;">${d.estimatedValue ? App.formatCurrency(d.estimatedValue) : ''}</div>
                  </div>
                  <div style="display:flex;align-items:center;gap:4px;overflow-x:auto;padding:4px 0;">
                    ${stages.map((s, i) => {
                      const isActive = i === currentIdx;
                      const isPast = i < currentIdx;
                      const isClosed = s === 'closed_won' || s === 'closed_lost';
                      return `
                        <div style="display:flex;align-items:center;flex-shrink:0;">
                          <div style="
                            width:32px;height:32px;border-radius:50%;
                            display:flex;align-items:center;justify-content:center;
                            font-size:12px;font-weight:700;
                            background:${isPast ? 'var(--accent)' : isActive ? 'var(--primary)' : 'var(--surface-2)'};
                            color:${isPast || isActive ? '#fff' : 'var(--text-muted)'};
                          ">${i + 1}</div>
                          <span style="
                            font-size:10px;position:absolute;margin-top:40px;
                            color:${isActive ? 'var(--primary)' : 'var(--text-muted)'};
                            font-weight:${isActive ? '600' : '400'};
                            white-space:nowrap;
                          ">${STAGE_LABELS[s] || s.replace(/_/g, ' ')}</span>
                          ${i < stages.length - 1 ? `<div style="width:24px;height:2px;background:${i < currentIdx ? 'var(--accent)' : 'var(--border)'};margin:0 2px;"></div>` : ''}
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    return html;
  } catch (err) {
    return `
      <div class="error-state">
        <span class="error-icon">⚠️</span>
        <p>${App.escapeHtml(err.message)}</p>
        <button class="btn btn-primary" onclick="App.render()">Try Again</button>
      </div>
    `;
  }
}

let activeConversationId = null;
let messagesPollTimer = null;

async function renderFranchiseeMessages() {
  $('pageTitle').innerHTML = 'Messages';

  if (messagesPollTimer) clearInterval(messagesPollTimer);

  try {
    const data = await api.getConversations();
    const conversations = data.conversations || [];

    let convHtml = '';
    if (!conversations.length) {
      convHtml = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:14px;">No conversations yet.</div>';
    } else {
      convHtml = conversations.map(c => {
        const other = c.participants?.find(p => p.id !== App.user?.id) || {};
        const name = other.firstName ? `${other.firstName} ${other.lastName || ''}` : (other.name || other.email || 'Unknown');
        const lastMsg = c.lastMessage || c.messages?.[c.messages.length - 1];
        return `
          <div class="conv-item ${activeConversationId === c.id ? 'active' : ''}" data-id="${c.id}" onclick="selectConversation('${c.id}')" style="
            display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;
            border-bottom:1px solid var(--border);
            ${activeConversationId === c.id ? 'background:var(--primary-dim);' : ''}
            ${c.unreadCount ? 'font-weight:600;' : ''}
          ">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--primary-dim);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">
              ${(name[0] || '?').toUpperCase()}
            </div>
            <div style="flex:1;min-width:0;overflow:hidden;">
              <div style="font-size:13px;font-weight:${c.unreadCount ? '600' : '400'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${App.escapeHtml(name)}</div>
              ${lastMsg ? `<div style="font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${App.escapeHtml(lastMsg.content || '')}</div>` : ''}
            </div>
            ${c.unreadCount ? `<span style="background:var(--primary);color:#fff;font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px;">${c.unreadCount}</span>` : ''}
          </div>
        `;
      }).join('');
    }

    const html = `
      <div style="display:grid;grid-template-columns:320px 1fr;gap:0;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;background:var(--surface);min-height:500px;">
        <div style="border-right:1px solid var(--border);display:flex;flex-direction:column;">
          <div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:600;font-size:14px;">Conversations</span>
            <button class="btn btn-sm btn-primary" onclick="showNewConversationModal()">New</button>
          </div>
          <div style="flex:1;overflow-y:auto;">${convHtml}</div>
        </div>
        <div id="messageThread" style="display:flex;flex-direction:column;background:var(--surface-2);">
          <div class="empty-state" style="min-height:400px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <span class="empty-icon">💬</span>
            <p>Select a conversation to start messaging</p>
          </div>
        </div>
      </div>
    `;

    if (activeConversationId) {
      setTimeout(() => selectConversation(activeConversationId), 50);
    }

    return html;
  } catch (err) {
    return `
      <div class="error-state">
        <span class="error-icon">⚠️</span>
        <p>${App.escapeHtml(err.message)}</p>
        <button class="btn btn-primary" onclick="App.render()">Try Again</button>
      </div>
    `;
  }
}

window.selectConversation = async function(conversationId) {
  activeConversationId = conversationId;
  if (messagesPollTimer) clearInterval(messagesPollTimer);

  document.querySelectorAll('.conv-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === conversationId);
    el.style.background = el.dataset.id === conversationId ? 'var(--primary-dim)' : '';
  });

  const thread = document.getElementById('messageThread');
  if (!thread) return;
  thread.innerHTML = '<div class="loading-state" style="min-height:400px;"><div class="spinner"></div></div>';

  try {
    const data = await api.getMessages(conversationId, 1, 100);
    const messages = data.messages || [];

    thread.innerHTML = `
      <div style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:8px;" id="msgList">
        ${messages.length ? messages.map(m => {
          const isMe = m.senderId === App.user?.id || m.sender?.id === App.user?.id;
          return `
            <div style="display:flex;justify-content:${isMe ? 'flex-end' : 'flex-start'};">
              <div style="
                max-width:75%;padding:10px 14px;border-radius:14px;
                background:${isMe ? 'var(--primary)' : 'var(--surface)'};
                color:${isMe ? '#fff' : 'var(--text)'};
                font-size:13px;line-height:1.5;
              ">
                <div>${App.escapeHtml(m.content || '')}</div>
                <div style="font-size:10px;opacity:.7;margin-top:4px;text-align:right;">${App.formatDate(m.createdAt)}</div>
              </div>
            </div>
          `;
        }).join('') : '<div style="text-align:center;color:var(--text-muted);padding:40px;font-size:14px;">No messages yet. Start the conversation!</div>'}
      </div>
      <div style="display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--border);background:var(--surface);">
        <input type="text" id="msgInput" placeholder="Type a message..." style="flex:1;padding:10px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" onkeydown="if(event.key==='Enter')sendMessage()" />
        <button class="btn btn-primary btn-sm" onclick="sendMessage()">Send</button>
      </div>
    `;

    const msgList = document.getElementById('msgList');
    if (msgList) msgList.scrollTop = msgList.scrollHeight;

    messagesPollTimer = setInterval(() => pollMessages(conversationId), 5000);
  } catch (err) {
    thread.innerHTML = `<div class="error-state"><p>${App.escapeHtml(err.message)}</p></div>`;
  }
};

window.sendMessage = async function() {
  const input = document.getElementById('msgInput');
  if (!input || !input.value.trim()) return;
  const content = input.value.trim();
  input.value = '';

  try {
    await api.sendMessage(activeConversationId, content);
    await selectConversation(activeConversationId);
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

async function pollMessages(conversationId) {
  if (!conversationId || conversationId !== activeConversationId) return;
  try {
    const data = await api.getMessages(conversationId, 1, 100);
    const messages = data.messages || [];
    const msgList = document.getElementById('msgList');
    if (!msgList) return;

    const currentCount = msgList.children.length;
    if (messages.length > currentCount) {
      await selectConversation(conversationId);
    }
  } catch { /* silent */ }
}

window.showNewConversationModal = function() {
  const content = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div>
        <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Recipient User ID</label>
        <input type="text" id="newConvUserId" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" placeholder="Enter user ID" />
      </div>
      <div>
        <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Message</label>
        <textarea id="newConvMsg" rows="3" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;resize:vertical;" placeholder="Write your first message..."></textarea>
      </div>
      <button class="btn btn-primary" onclick="startNewConversation()">Start Conversation</button>
    </div>
  `;
  renderModal('newConvModal', 'New Conversation', content);
};

window.startNewConversation = async function() {
  const userId = document.getElementById('newConvUserId')?.value?.trim();
  const msg = document.getElementById('newConvMsg')?.value?.trim();
  if (!userId) return renderToast('Please enter a user ID', 'error');
  if (!msg) return renderToast('Please write a message', 'error');

  try {
    const data = await api.startConversation(userId, msg);
    document.getElementById('newConvModal')?.remove();
    renderToast('Conversation started!', 'success');
    activeConversationId = data.conversation?.id;
    App.render();
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

async function renderFranchiseeNetwork() {
  $('pageTitle').innerHTML = 'Network';

  const tab = new URLSearchParams(window.location.hash.split('?')[1]).get('tab') || 'connections';
  let activeTab = tab;

  try {
    const data = await api.getConnections();
    const connections = data.connections || [];
    const pending = data.pending || [];
    const sent = data.sent || [];

    return `
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <button class="btn btn-sm ${activeTab === 'connections' ? 'btn-primary' : 'btn-outline'}" onclick="switchNetworkTab('connections')">Connections (${connections.length})</button>
        <button class="btn btn-sm ${activeTab === 'pending' ? 'btn-primary' : 'btn-outline'}" onclick="switchNetworkTab('pending')">Pending (${pending.length})</button>
        <button class="btn btn-sm ${activeTab === 'sent' ? 'btn-primary' : 'btn-outline'}" onclick="switchNetworkTab('sent')">Sent (${sent.length})</button>
      </div>
      <div id="networkContent">
        ${activeTab === 'connections' ? renderConnectionList(connections) :
          activeTab === 'pending' ? renderPendingList(pending) :
          renderSentList(sent)}
      </div>
      <div class="card" style="margin-top:16px;">
        <div class="card-header"><h3>Find Brokers & Franchisors</h3></div>
        <div class="card-body">
          <p style="font-size:14px;color:var(--text-muted);margin-bottom:12px;">Connect with industry professionals to grow your network.</p>
          <div style="display:flex;gap:8px;">
            <input type="text" id="networkSearch" placeholder="Search by name or email..." style="flex:1;padding:10px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
            <button class="btn btn-sm btn-primary" onclick="searchNetwork()">Search</button>
          </div>
          <div id="networkSearchResults"></div>
        </div>
      </div>
    `;
  } catch (err) {
    return `
      <div class="error-state">
        <span class="error-icon">⚠️</span>
        <p>${App.escapeHtml(err.message)}</p>
        <button class="btn btn-primary" onclick="App.render()">Try Again</button>
      </div>
    `;
  }
}

function renderConnectionList(connections) {
  if (!connections.length) {
    return `<div class="empty-state"><span class="empty-icon">🤝</span><p>No connections yet.</p></div>`;
  }
  return `
    <div class="card">
      <div class="card-body" style="padding:0;">
        ${connections.map(c => {
          const user = c.connectedUser || c.user || {};
          const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown';
          const role = user.role || c.role || '';
          return `
            <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border);">
              <div style="width:38px;height:38px;border-radius:50%;background:var(--primary-dim);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;">${(name[0] || '?').toUpperCase()}</div>
              <div style="flex:1;">
                <div style="font-weight:600;font-size:14px;">${App.escapeHtml(name)}</div>
                <div style="font-size:12px;color:var(--text-muted);">${App.escapeHtml(role)}${c.connectedAt ? ' · Connected ' + App.daysAgo(c.connectedAt) : ''}</div>
              </div>
              <span class="status-badge active">Connected</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderPendingList(pending) {
  if (!pending.length) {
    return `<div class="empty-state"><span class="empty-icon">⏳</span><p>No pending connection requests.</p></div>`;
  }
  return `
    <div class="card">
      <div class="card-body" style="padding:0;">
        ${pending.map(c => {
          const user = c.connectedUser || c.user || {};
          const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown';
          const role = user.role || c.role || '';
          return `
            <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border);">
              <div style="width:38px;height:38px;border-radius:50%;background:var(--primary-dim);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;">${(name[0] || '?').toUpperCase()}</div>
              <div style="flex:1;">
                <div style="font-weight:600;font-size:14px;">${App.escapeHtml(name)}</div>
                <div style="font-size:12px;color:var(--text-muted);">${App.escapeHtml(role)}</div>
              </div>
              <div style="display:flex;gap:6px;">
                <button class="btn btn-sm btn-primary" onclick="respondConnection('${c.id}', 'accepted')">Accept</button>
                <button class="btn btn-sm btn-danger" onclick="respondConnection('${c.id}', 'declined')">Decline</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderSentList(sent) {
  if (!sent.length) {
    return `<div class="empty-state"><span class="empty-icon">📤</span><p>No sent requests.</p></div>`;
  }
  return `
    <div class="card">
      <div class="card-body" style="padding:0;">
        ${sent.map(c => {
          const user = c.connectedUser || c.user || {};
          const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown';
          return `
            <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border);">
              <div style="width:38px;height:38px;border-radius:50%;background:var(--primary-dim);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;">${(name[0] || '?').toUpperCase()}</div>
              <div style="flex:1;">
                <div style="font-weight:600;font-size:14px;">${App.escapeHtml(name)}</div>
                <div style="font-size:12px;color:var(--text-muted);">Request sent ${App.daysAgo(c.createdAt)}</div>
              </div>
              <span class="status-badge pending">Pending</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

window.switchNetworkTab = function(tab) {
  const hash = `network?tab=${tab}`;
  window.location.hash = hash;
  App.currentView = 'network';
  App.render();
};

window.searchNetwork = async function() {
  const q = document.getElementById('networkSearch')?.value?.trim();
  const results = document.getElementById('networkSearchResults');
  if (!results) return;
  if (!q) { results.innerHTML = ''; return; }

  results.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);">Searching...</div>';
  try {
    await api.requestConnection(q);
    results.innerHTML = '<div style="padding:12px;color:var(--accent);font-weight:600;">Connection request sent!</div>';
    App.render();
  } catch (err) {
    results.innerHTML = `<div style="padding:12px;color:#EF4444;font-size:13px;">${App.escapeHtml(err.message)}</div>`;
  }
};

window.respondConnection = async function(id, status) {
  try {
    await api.respondConnection(id, status);
    renderToast(status === 'accepted' ? 'Connection accepted!' : 'Connection declined', 'success');
    App.render();
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

async function renderFranchiseeDocuments() {
  $('pageTitle').innerHTML = 'Documents';

  try {
    const pipeline = await api.getPipeline();
    const leads = pipeline.leads || [];
    const deals = pipeline.deals || [];

    const allItems = [...leads, ...deals];
    const docs = [];

    allItems.forEach(item => {
      if (item.documents && item.documents.length) {
        item.documents.forEach(d => docs.push({ ...d, listing: item.franchiseListing || item.listing }));
      }
    });

    if (!docs.length) {
      return `
        <div class="empty-state">
          <span class="empty-icon">📄</span>
          <p>No documents yet. Documents will appear here when you request information on listings.</p>
        </div>
      `;
    }

    return `
      <div class="card">
        <div class="card-body" style="padding:0;">
          <div class="table-wrap"><table>
            <thead><tr><th>Document</th><th>Listing</th><th>Last Updated</th><th></th></tr></thead>
            <tbody>${docs.map(d => `
              <tr>
                <td style="font-weight:600;">${App.escapeHtml(d.name || d.fileName || 'Document')}</td>
                <td>${App.escapeHtml(d.listing?.title || '-')}</td>
                <td style="color:var(--text-muted);font-size:13px;">${App.formatDate(d.updatedAt || d.createdAt)}</td>
                <td>${d.url || d.fileUrl ? `<a href="${App.escapeHtml(d.url || d.fileUrl)}" class="btn btn-sm btn-outline" target="_blank" download>Download</a>` : '-'}</td>
              </tr>
            `).join('')}</tbody>
          </table></div>
        </div>
      </div>
    `;
  } catch (err) {
    return `
      <div class="error-state">
        <span class="error-icon">⚠️</span>
        <p>${App.escapeHtml(err.message)}</p>
        <button class="btn btn-primary" onclick="App.render()">Try Again</button>
      </div>
    `;
  }
}

async function renderFranchiseeProfile() {
  $('pageTitle').innerHTML = 'Profile';

  try {
    const data = await api.getProfile();
    const profile = data.profile || {};
    const interests = profile.interests || {};

    const industries = [
      'Food & Beverage', 'Retail', 'Health & Fitness', 'Education',
      'Home Services', 'Business Services', 'Hospitality', 'Automotive',
      'Real Estate', 'Technology', 'Pet Care', 'Senior Care',
    ];

    const selectedIndustries = interests.industries || [];

    return `
      <div class="card">
        <div class="card-header"><h3>Investment Profile</h3></div>
        <div class="card-body">
          <form id="profileForm" onsubmit="saveProfile(event)">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div class="info-group" style="background:transparent;padding:0;">
                <label>Investment Capacity (Min)</label>
                <input type="number" name="investmentCapacityMin" value="${profile.investmentCapacityMin || ''}" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;margin-top:4px;" />
              </div>
              <div class="info-group" style="background:transparent;padding:0;">
                <label>Investment Capacity (Max)</label>
                <input type="number" name="investmentCapacityMax" value="${profile.investmentCapacityMax || ''}" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;margin-top:4px;" />
              </div>
              <div class="info-group" style="background:transparent;padding:0;">
                <label>Liquid Capital</label>
                <input type="number" name="liquidCapital" value="${profile.liquidCapital || ''}" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;margin-top:4px;" />
              </div>
              <div class="info-group" style="background:transparent;padding:0;">
                <label>Net Worth</label>
                <input type="number" name="netWorth" value="${profile.netWorth || ''}" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;margin-top:4px;" />
              </div>
              <div class="info-group" style="background:transparent;padding:0;">
                <label>Timeline</label>
                <select name="timeline" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;margin-top:4px;">
                  <option value="">Select timeline</option>
                  <option value="immediately" ${profile.timeline === 'immediately' ? 'selected' : ''}>Immediately</option>
                  <option value="3_months" ${profile.timeline === '3_months' ? 'selected' : ''}>Within 3 months</option>
                  <option value="6_months" ${profile.timeline === '6_months' ? 'selected' : ''}>Within 6 months</option>
                  <option value="1_year" ${profile.timeline === '1_year' ? 'selected' : ''}>Within 1 year</option>
                  <option value="exploring" ${profile.timeline === 'exploring' ? 'selected' : ''}>Just exploring</option>
                </select>
              </div>
              <div class="info-group" style="background:transparent;padding:0;">
                <label>Background</label>
                <textarea name="background" rows="2" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;margin-top:4px;resize:vertical;">${App.escapeHtml(profile.background || '')}</textarea>
              </div>
            </div>

            <div style="margin-top:20px;">
              <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;">Industries of Interest</label>
              <div class="chip-list" style="gap:8px;">
                ${industries.map(ind => {
                  const sel = selectedIndustries.includes(ind);
                  return `
                    <span class="chip" style="cursor:pointer;${sel ? 'background:var(--primary);color:#fff;' : ''}" onclick="toggleIndustryChip(this, '${App.escapeHtml(ind)}')">${App.escapeHtml(ind)}</span>
                  `;
                }).join('')}
              </div>
              <input type="hidden" name="industries" id="industriesInput" value='${JSON.stringify(selectedIndustries)}' />
            </div>

            <div style="margin-top:16px;">
              <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Preferred Locations</label>
              <input type="text" name="locations" value="${(interests.locations || []).join(', ')}" placeholder="e.g., Texas, Florida, New York" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
            </div>

            <div style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div class="info-group" style="background:transparent;padding:0;">
                <label>Public Headline</label>
                <input type="text" name="headline" value="${App.escapeHtml(profile.headline || '')}" placeholder="e.g., Aspiring franchise owner" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;margin-top:4px;" />
              </div>
              <div class="info-group" style="background:transparent;padding:0;">
                <label>Public Bio</label>
                <textarea name="bio" rows="2" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;margin-top:4px;resize:vertical;">${App.escapeHtml(profile.bio || '')}</textarea>
              </div>
            </div>

            <div style="margin-top:20px;">
              <button type="submit" class="btn btn-primary">Save Profile</button>
            </div>
          </form>
        </div>
      </div>
    `;
  } catch (err) {
    return `
      <div class="error-state">
        <span class="error-icon">⚠️</span>
        <p>${App.escapeHtml(err.message)}</p>
        <button class="btn btn-primary" onclick="App.render()">Try Again</button>
      </div>
    `;
  }
}

window.toggleIndustryChip = function(el, industry) {
  el.classList.toggle('selected');
  if (el.style.background === 'var(--primary)' || el.style.color === 'rgb(255, 255, 255)') {
    el.style.background = '';
    el.style.color = '';
  } else {
    el.style.background = 'var(--primary)';
    el.style.color = '#fff';
  }
  updateIndustriesInput();
};

function updateIndustriesInput() {
  const chips = document.querySelectorAll('.chip-list .chip');
  const selected = [];
  chips.forEach(chip => {
    if (chip.style.background === 'var(--primary)' || chip.style.color === 'rgb(255, 255, 255)') {
      selected.push(chip.textContent.trim());
    }
  });
  const input = document.getElementById('industriesInput');
  if (input) input.value = JSON.stringify(selected);
}

window.saveProfile = async function(event) {
  event.preventDefault();
  const form = document.getElementById('profileForm');
  if (!form) return;
  const fd = new FormData(form);

  const industries = fd.get('industries');
  const locations = fd.get('locations');

  const data = {
    investmentCapacityMin: fd.get('investmentCapacityMin') ? Number(fd.get('investmentCapacityMin')) : undefined,
    investmentCapacityMax: fd.get('investmentCapacityMax') ? Number(fd.get('investmentCapacityMax')) : undefined,
    liquidCapital: fd.get('liquidCapital') ? Number(fd.get('liquidCapital')) : undefined,
    netWorth: fd.get('netWorth') ? Number(fd.get('netWorth')) : undefined,
    timeline: fd.get('timeline') || undefined,
    background: fd.get('background') || undefined,
    headline: fd.get('headline') || undefined,
    bio: fd.get('bio') || undefined,
    interests: {
      industries: industries ? JSON.parse(industries) : [],
      locations: locations ? locations.split(',').map(s => s.trim()).filter(Boolean) : [],
    },
  };

  try {
    await api.updateProfile(data);
    renderToast('Profile saved successfully!', 'success');
  } catch (err) {
    renderToast(err.message, 'error');
  }
};
