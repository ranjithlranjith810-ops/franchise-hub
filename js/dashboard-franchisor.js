let pipelineDragItem = null;

function getStageDisplayName(stage) {
  return STAGE_LABELS[stage] || (stage || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function renderFranchisorOverview() {
  const p = App.profile || {};
  const s = p.stats || {};
  const user = App.user || {};

  $('pageTitle').innerHTML = `Dashboard <span class="greeting">Welcome back, ${App.escapeHtml(user.firstName || '')}</span>`;

  const newLeads = s.newLeads7d ?? s.newLeads ?? 0;
  const activeDeals = s.activeDeals ?? 0;
  const closedThisMonth = s.closedThisMonth ?? 0;
  const conversionRate = s.conversionRate ?? 0;

  const stats = [
    { label: 'New Leads (7 days)', value: newLeads },
    { label: 'Active Deals', value: activeDeals },
    { label: 'Closed This Month', value: closedThisMonth },
    { label: 'Conversion Rate', value: `${conversionRate}%` },
  ];

  let html = `
    <div class="stats-grid">
      ${stats.map(st => `
        <div class="stat-card">
          <div class="stat-label">${st.label}</div>
          <div class="stat-value">${st.value}</div>
        </div>
      `).join('')}
    </div>
  `;

  const pipelineData = s.pipelineData || {};

  html += `
    <div class="card">
      <div class="card-header"><h3>Deal Funnel</h3></div>
      <div class="card-body">
        <div style="display:flex;gap:8px;align-items:end;height:180px;padding:0 8px;">
          ${DEAL_STAGES.filter(st => st !== 'closed_won' && st !== 'closed_lost').map(stage => {
            const count = pipelineData[stage] || 0;
            const maxCount = Math.max(1, ...DEAL_STAGES.map(s => pipelineData[s] || 0));
            const height = Math.max(8, (count / maxCount) * 160);
            return `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
                <span style="font-size:12px;font-weight:600;color:var(--text-muted);">${count}</span>
                <div style="width:100%;height:${height}px;background:var(--primary);border-radius:6px 6px 2px 2px;min-height:8px;opacity:${count ? 1 : .3};"></div>
                <span style="font-size:10px;text-align:center;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${getStageDisplayName(stage)}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  const recentActivity = s.recentActivity || [];
  if (recentActivity.length) {
    html += `
      <div class="card">
        <div class="card-header"><h3>Recent Activity</h3></div>
        <div class="card-body" style="padding:0;">
          ${recentActivity.slice(0, 10).map(a => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 20px;border-bottom:1px solid var(--border);font-size:13px;">
              <span>${a.icon || '📌'}</span>
              <span style="flex:1;">${App.escapeHtml(a.message || a.description || '')}</span>
              <span style="color:var(--text-muted);font-size:11px;">${App.daysAgo(a.createdAt)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  const brands = p.brands || [];
  if (brands.length) {
    html += `
      <div class="card">
        <div class="card-header"><h3>Brands Overview</h3><a href="#" onclick="App.navigate('brands');return false;" class="card-link">View all</a></div>
        <div class="card-body" style="padding:0;">
          <div class="table-wrap"><table>
            <thead><tr><th>Brand</th><th>Listings</th><th>Active Deals</th><th>Status</th></tr></thead>
            <tbody>${brands.map(b => `
              <tr>
                <td style="font-weight:600;">${App.escapeHtml(b.name || '')}</td>
                <td>${b.listingCount ?? b.listings?.length ?? 0}</td>
                <td>${b.activeDeals ?? 0}</td>
                <td>${renderStatusBadge(b.status || 'active')}</td>
              </tr>
            `).join('')}</tbody>
          </table></div>
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="card">
        <div class="card-body">
          <div class="empty-state">
            <span class="empty-icon">🏢</span>
            <p>No brands yet. Create your first brand to get started.</p>
            <button class="btn btn-primary" onclick="showCreateBrandModal()" style="margin-top:12px;">Add Brand</button>
          </div>
        </div>
      </div>
    `;
  }

  return html;
}

async function renderFranchisorBrands() {
  $('pageTitle').innerHTML = 'Brands';

  try {
    const data = await api.getBrands();
    const brands = data.brands || [];

    if (!brands.length) {
      return `
        <div style="margin-bottom:16px;">
          <button class="btn btn-primary" onclick="showCreateBrandModal()">+ Add Brand</button>
        </div>
        <div class="empty-state">
          <span class="empty-icon">🏢</span>
          <p>No brands yet. Create your first brand to get started.</p>
        </div>
      `;
    }

    return `
      <div style="margin-bottom:16px;">
        <button class="btn btn-primary" onclick="showCreateBrandModal()">+ Add Brand</button>
      </div>
      <div class="listing-grid">
        ${brands.map(b => {
          const listingCount = b.listingCount ?? b.listings?.length ?? 0;
          const dealCount = b.activeDeals ?? 0;
          return `
            <div class="listing-card" style="cursor:pointer;" onclick="App.navigate('brand-detail','${b.id}')">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div style="width:44px;height:44px;border-radius:12px;background:var(--primary-dim);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:var(--primary);">${(b.name || 'B')[0]}</div>
                <span>${renderStatusBadge(b.status || 'active')}</span>
              </div>
              <h4 style="margin-top:10px;">${App.escapeHtml(b.name || '')}</h4>
              ${b.industry ? `<div class="listing-meta">${App.escapeHtml(b.industry.name || b.industry)}</div>` : ''}
              <div style="display:flex;gap:12px;margin-top:8px;">
                <span style="font-size:12px;color:var(--text-muted);">📋 ${listingCount} listings</span>
                <span style="font-size:12px;color:var(--text-muted);">🤝 ${dealCount} deals</span>
              </div>
              <div style="display:flex;gap:6px;margin-top:10px;">
                <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();showEditBrandModal('${b.id}')">Edit</button>
                <button class="btn btn-sm ${b.status === 'active' ? 'btn-danger' : 'btn-primary'}" onclick="event.stopPropagation();toggleBrandStatus('${b.id}','${b.status}')">${b.status === 'active' ? 'Deactivate' : 'Activate'}</button>
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

window.showCreateBrandModal = function() {
  const content = `
    <form id="brandForm" onsubmit="createBrand(event)">
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Brand Name</label>
          <input type="text" name="name" required style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Industry</label>
          <select name="industry" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;">
            <option value="">Select industry</option>
            <option value="Food & Beverage">Food & Beverage</option>
            <option value="Retail">Retail</option>
            <option value="Health & Fitness">Health & Fitness</option>
            <option value="Education">Education</option>
            <option value="Home Services">Home Services</option>
            <option value="Business Services">Business Services</option>
            <option value="Hospitality">Hospitality</option>
            <option value="Automotive">Automotive</option>
            <option value="Real Estate">Real Estate</option>
            <option value="Technology">Technology</option>
          </select>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Description</label>
          <textarea name="description" rows="3" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;resize:vertical;"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Founded Year</label>
            <input type="number" name="foundedYear" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Total Units</label>
            <input type="number" name="totalUnits" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
          </div>
        </div>
        <button type="submit" class="btn btn-primary">Create Brand</button>
      </div>
    </form>
  `;
  renderModal('createBrandModal', 'Add Brand', content);
};

window.createBrand = async function(event) {
  event.preventDefault();
  const form = document.getElementById('brandForm');
  if (!form) return;
  const fd = new FormData(form);
  const data = {
    name: fd.get('name'),
    industry: fd.get('industry') || undefined,
    description: fd.get('description') || undefined,
    foundedYear: fd.get('foundedYear') ? Number(fd.get('foundedYear')) : undefined,
    totalUnits: fd.get('totalUnits') ? Number(fd.get('totalUnits')) : undefined,
  };
  try {
    await api.createBrand(data);
    document.getElementById('createBrandModal')?.remove();
    renderToast('Brand created!', 'success');
    App.render();
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

window.showEditBrandModal = async function(brandId) {
  try {
    const data = await api.getBrandDetail(brandId);
    const brand = data.brand || {};
    const content = `
      <form id="editBrandForm" onsubmit="updateBrand(event,'${brandId}')">
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Brand Name</label>
            <input type="text" name="name" value="${App.escapeHtml(brand.name || '')}" required style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Description</label>
            <textarea name="description" rows="3" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;resize:vertical;">${App.escapeHtml(brand.description || '')}</textarea>
          </div>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    `;
    renderModal('editBrandModal', 'Edit Brand', content);
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

window.updateBrand = async function(event, brandId) {
  event.preventDefault();
  const form = document.getElementById('editBrandForm');
  if (!form) return;
  const fd = new FormData(form);
  const data = {
    name: fd.get('name'),
    description: fd.get('description') || undefined,
  };
  try {
    await api.updateBrand(brandId, data);
    document.getElementById('editBrandModal')?.remove();
    renderToast('Brand updated!', 'success');
    App.render();
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

window.toggleBrandStatus = async function(brandId, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  try {
    await api.updateBrandStatus(brandId, newStatus);
    renderToast(`Brand ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'success');
    App.render();
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

async function renderFranchisorBrandDetail(brandId) {
  $('pageTitle').innerHTML = 'Brand Detail';

  try {
    const data = await api.getBrandDetail(brandId);
    const brand = data.brand || {};
    const listings = data.listings || [];

    return `
      <button class="btn btn-sm btn-outline" onclick="App.navigate('brands')" style="margin-bottom:16px;">&larr; Back to Brands</button>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div>
          <div class="card">
            <div class="card-header">
              <h3>Brand Info</h3>
              <span>${renderStatusBadge(brand.status || 'active')}</span>
            </div>
            <div class="card-body">
              <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
                <div style="width:56px;height:56px;border-radius:14px;background:var(--primary-dim);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:var(--primary);">${(brand.name || 'B')[0]}</div>
                <div>
                  <h2 style="font-family:'Manrope',sans-serif;font-size:20px;">${App.escapeHtml(brand.name || '')}</h2>
                  ${brand.industry ? `<div style="font-size:13px;color:var(--text-muted);">${App.escapeHtml(brand.industry.name || brand.industry)}</div>` : ''}
                </div>
              </div>
              <form id="brandDetailForm">
                <div style="display:flex;flex-direction:column;gap:12px;">
                  <div>
                    <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Name</label>
                    <input type="text" name="name" value="${App.escapeHtml(brand.name || '')}" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
                  </div>
                  <div>
                    <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Industry</label>
                    <input type="text" name="industry" value="${App.escapeHtml(brand.industry?.name || brand.industry || '')}" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
                  </div>
                  <div>
                    <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Description</label>
                    <textarea name="description" rows="3" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;resize:vertical;">${App.escapeHtml(brand.description || '')}</textarea>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div>
                      <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Founded Year</label>
                      <input type="number" name="foundedYear" value="${brand.foundedYear || ''}" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
                    </div>
                    <div>
                      <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Total Units</label>
                      <input type="number" name="totalUnits" value="${brand.totalUnits || ''}" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;gap:10px;margin-top:4px;">
                    <label style="font-size:13px;">Status:</label>
                    <button type="button" class="btn btn-sm ${brand.status === 'active' ? 'btn-primary' : 'btn-outline'}" onclick="updateBrandStatusFromDetail('${brandId}', '${brand.status === 'active' ? 'inactive' : 'active'}')">
                      ${brand.status === 'active' ? '🔵 Active' : '⚪ Inactive'}
                    </button>
                  </div>
                  <button type="submit" class="btn btn-primary" onclick="saveBrandDetail(event,'${brandId}')">Save Brand Info</button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div>
          <div class="card">
            <div class="card-header"><h3>Financials</h3></div>
            <div class="card-body">
              <div class="info-grid">
                <div class="info-group"><label>Investment Range</label><div class="value">${App.formatCurrency(brand.investmentMin)} - ${App.formatCurrency(brand.investmentMax)}</div></div>
                <div class="info-group"><label>Franchise Fee</label><div class="value">${App.formatCurrency(brand.franchiseFee)}</div></div>
                <div class="info-group"><label>Royalty %</label><div class="value">${brand.royaltyPercentage || brand.royalty || '-'}</div></div>
                <div class="info-group"><label>Marketing Fee %</label><div class="value">${brand.marketingFeePercentage || brand.marketingFee || '-'}</div></div>
                <div class="info-group"><label>Net Worth Req.</label><div class="value">${App.formatCurrency(brand.netWorthRequired || brand.netWorthReq)}</div></div>
                <div class="info-group"><label>Liquid Capital Req.</label><div class="value">${App.formatCurrency(brand.liquidCapitalRequired || brand.liquidCapitalReq)}</div></div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3>Listings (${listings.length})</h3>
              <button class="btn btn-sm btn-primary" onclick="showCreateListingModal('${brandId}')">+ Add</button>
            </div>
            <div class="card-body" style="padding:0;">
              ${listings.length ? `
                <div class="table-wrap"><table>
                  <thead><tr><th>Title</th><th>Investment</th><th>Status</th></tr></thead>
                  <tbody>${listings.map(l => `
                    <tr>
                      <td style="font-weight:600;">${App.escapeHtml(l.title || '')}</td>
                      <td style="font-size:13px;">${App.formatCurrency(l.investmentMin)} - ${App.formatCurrency(l.investmentMax)}</td>
                      <td>${renderStatusBadge(l.status || 'draft')}</td>
                    </tr>
                  `).join('')}</tbody>
                </table></div>
              ` : `
                <div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">No listings for this brand yet.</div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    return `
      <button class="btn btn-sm btn-outline" onclick="App.navigate('brands')" style="margin-bottom:16px;">&larr; Back to Brands</button>
      <div class="error-state">
        <span class="error-icon">⚠️</span>
        <p>${App.escapeHtml(err.message)}</p>
        <button class="btn btn-primary" onclick="App.render()">Try Again</button>
      </div>
    `;
  }
}

window.saveBrandDetail = async function(event, brandId) {
  event.preventDefault();
  const form = document.getElementById('brandDetailForm');
  if (!form) return;
  const fd = new FormData(form);
  const data = {
    name: fd.get('name'),
    industry: fd.get('industry') || undefined,
    description: fd.get('description') || undefined,
    foundedYear: fd.get('foundedYear') ? Number(fd.get('foundedYear')) : undefined,
    totalUnits: fd.get('totalUnits') ? Number(fd.get('totalUnits')) : undefined,
  };
  try {
    await api.updateBrand(brandId, data);
    renderToast('Brand updated!', 'success');
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

window.updateBrandStatusFromDetail = async function(brandId, newStatus) {
  try {
    await api.updateBrandStatus(brandId, newStatus);
    renderToast(`Brand ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'success');
    App.render();
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

async function renderFranchisorListings() {
  $('pageTitle').innerHTML = 'Listings';

  try {
    const brandsData = await api.getBrands();
    const brands = brandsData.brands || [];
    const allListings = [];

    for (const b of brands) {
      try {
        const bData = await api.getBrandListings(b.id);
        const bListings = bData.listings || [];
        bListings.forEach(l => {
          allListings.push({ ...l, brandName: b.name, brandId: b.id });
        });
      } catch { /* skip brands that fail */ }
    }

    return `
      <div style="margin-bottom:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="showCreateListingModal()">+ Create Listing</button>
        <select id="listingFilterBrand" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:13px;" onchange="filterListingsTable()">
          <option value="">All Brands</option>
          ${brands.map(b => `<option value="${b.id}">${App.escapeHtml(b.name)}</option>`).join('')}
        </select>
        <select id="listingFilterStatus" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:13px;" onchange="filterListingsTable()">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <div class="card">
        <div class="card-body" style="padding:0;">
          <div class="table-wrap"><table id="listingsTable">
            <thead><tr>
              <th>Brand</th><th>Title</th><th>Status</th><th>Investment Range</th><th>Location</th><th>Leads</th><th>Deals</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${allListings.length ? allListings.map(l => `
                <tr class="listing-row" data-brand="${l.brandId || ''}" data-status="${l.status || ''}">
                  <td style="font-weight:600;">${App.escapeHtml(l.brandName || '')}</td>
                  <td>${App.escapeHtml(l.title || '')}</td>
                  <td>${renderStatusBadge(l.status || 'draft')}</td>
                  <td style="font-size:13px;">${App.formatCurrency(l.investmentMin)} - ${App.formatCurrency(l.investmentMax)}</td>
                  <td style="font-size:13px;color:var(--text-muted);">${l.territory ? [l.territory.city, l.territory.stateProvince].filter(Boolean).join(', ') : '-'}</td>
                  <td>${l.leadCount ?? 0}</td>
                  <td>${l.dealCount ?? 0}</td>
                  <td>
                    <button class="btn btn-sm btn-outline" onclick="showEditListingModal('${l.id}')">Edit</button>
                  </td>
                </tr>
              `).join('') : `
                <tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted);">No listings yet.</td></tr>
              `}
            </tbody>
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

window.filterListingsTable = function() {
  const brandFilter = document.getElementById('listingFilterBrand')?.value || '';
  const statusFilter = document.getElementById('listingFilterStatus')?.value || '';
  document.querySelectorAll('.listing-row').forEach(row => {
    const matchesBrand = !brandFilter || row.dataset.brand === brandFilter;
    const matchesStatus = !statusFilter || row.dataset.status === statusFilter;
    row.style.display = matchesBrand && matchesStatus ? '' : 'none';
  });
};

window.showCreateListingModal = function(preselectedBrandId) {
  api.getBrands().then(data => {
    const brands = data.brands || [];
    const content = `
      <form id="createListingForm" onsubmit="createListing(event)">
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Brand</label>
            <select name="brandId" required style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;">
              <option value="">Select brand</option>
              ${brands.map(b => `
                <option value="${b.id}" ${preselectedBrandId === b.id ? 'selected' : ''}>${App.escapeHtml(b.name)}</option>
              `).join('')}
            </select>
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Title</label>
            <input type="text" name="title" required style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Description</label>
            <textarea name="description" rows="3" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;resize:vertical;"></textarea>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Min Investment</label>
              <input type="number" name="investmentMin" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Max Investment</label>
              <input type="number" name="investmentMax" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
            </div>
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Territory (City, State)</label>
            <input type="text" name="territory" placeholder="e.g., Austin, TX" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Status</label>
            <select name="status" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;">
              <option value="draft">Draft</option>
              <option value="active">Active</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary">Create Listing</button>
        </div>
      </form>
    `;
    renderModal('createListingModal', 'Create Listing', content);
  }).catch(err => renderToast(err.message, 'error'));
};

window.createListing = async function(event) {
  event.preventDefault();
  const form = document.getElementById('createListingForm');
  if (!form) return;
  const fd = new FormData(form);
  const territory = fd.get('territory') || '';
  const territoryParts = territory.split(',').map(s => s.trim());
  const data = {
    brandId: fd.get('brandId'),
    title: fd.get('title'),
    description: fd.get('description') || undefined,
    investmentMin: fd.get('investmentMin') ? Number(fd.get('investmentMin')) : undefined,
    investmentMax: fd.get('investmentMax') ? Number(fd.get('investmentMax')) : undefined,
    territory: territory ? { city: territoryParts[0] || '', stateProvince: territoryParts[1] || '' } : undefined,
    status: fd.get('status') || 'draft',
  };
  try {
    await api.createListing(data);
    document.getElementById('createListingModal')?.remove();
    renderToast('Listing created!', 'success');
    App.render();
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

window.showEditListingModal = async function(listingId) {
  try {
    const data = await api.getListingDetail(listingId);
    const listing = data.listing || {};
    const brandsData = await api.getBrands();
    const brands = brandsData.brands || [];

    const content = `
      <form id="editListingForm" onsubmit="updateListing(event,'${listingId}')">
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Title</label>
            <input type="text" name="title" value="${App.escapeHtml(listing.title || '')}" required style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Description</label>
            <textarea name="description" rows="3" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;resize:vertical;">${App.escapeHtml(listing.description || '')}</textarea>
          </div>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    `;
    renderModal('editListingModal', 'Edit Listing', content);
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

window.updateListing = async function(event, listingId) {
  event.preventDefault();
  const form = document.getElementById('editListingForm');
  if (!form) return;
  const fd = new FormData(form);
  const data = {
    title: fd.get('title'),
    description: fd.get('description') || undefined,
  };
  try {
    await api.updateListing(listingId, data);
    document.getElementById('editListingModal')?.remove();
    renderToast('Listing updated!', 'success');
    App.render();
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

function renderFranchisorCreateListingModal() {
  showCreateListingModal();
}

async function renderFranchisorPipeline() {
  $('pageTitle').innerHTML = 'Pipeline';

  try {
    const data = await api.getDeals();
    const deals = data.deals || [];
    const brandsData = await api.getBrands();
    const brands = brandsData.brands || [];

    const grouped = {};
    DEAL_STAGES.forEach(s => { grouped[s] = []; });
    deals.forEach(d => {
      const stage = d.stage || 'inquiry';
      if (grouped[stage]) grouped[stage].push(d);
    });

    const allStages = DEAL_STAGES;

    return `
      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
        <select id="pipelineFilterBrand" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:13px;">
          <option value="">All Brands</option>
          ${brands.map(b => `<option value="${b.id}">${App.escapeHtml(b.name)}</option>`).join('')}
        </select>
        <select id="pipelineFilterStage" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:13px;">
          <option value="">All Stages</option>
          ${allStages.map(s => `<option value="${s}">${getStageDisplayName(s)}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:12px;min-height:500px;">
        ${allStages.map(stage => {
          const stageDeals = grouped[stage] || [];
          return `
            <div class="kanban-column" data-stage="${stage}" style="
              min-width:240px;max-width:280px;flex-shrink:0;
              background:var(--surface-2);border-radius:var(--radius);
              display:flex;flex-direction:column;border:1px solid var(--border);
            " ondragover="event.preventDefault()" ondrop="dropDeal(event,'${stage}')">
              <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:12px;font-weight:600;">${getStageDisplayName(stage)}</span>
                <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:var(--surface);color:var(--text-muted);font-weight:600;">${stageDeals.length}</span>
              </div>
              <div style="flex:1;overflow-y:auto;padding:8px;">
                ${stageDeals.length ? stageDeals.map(d => {
                  const franchisee = d.franchiseeUser || {};
                  const fName = `${franchisee.firstName || ''} ${franchisee.lastName || ''}`.trim() || 'Unknown';
                  const listing = d.franchiseListing || d.listing || {};
                  return `
                    <div class="kanban-card" draggable="true" ondragstart="dragDeal(event,'${d.id}')" onclick="showDealDetail('${d.id}')" style="
                      background:var(--surface);border:1px solid var(--border);border-radius:10px;
                      padding:12px;margin-bottom:8px;cursor:pointer;box-shadow:var(--shadow);
                    ">
                      <div style="font-weight:600;font-size:13px;margin-bottom:2px;">${App.escapeHtml(fName)}</div>
                      <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">${App.escapeHtml(listing.title || '')}</div>
                      <div style="display:flex;justify-content:space-between;font-size:11px;">
                        <span style="color:var(--text-muted);">${d.daysInStage ?? App.daysAgo(d.updatedAt || d.createdAt)}</span>
                        <span style="font-weight:600;">${d.estimatedValue ? App.formatCurrency(d.estimatedValue) : ''}</span>
                      </div>
                      ${d.broker ? `<div style="font-size:10px;color:var(--text-muted);margin-top:4px;">Broker: ${App.escapeHtml(d.broker.name || d.broker)}</div>` : ''}
                      ${stage === 'closed_won' ? `<div style="margin-top:4px;"><span class="status-badge active">Closed Won</span></div>` : ''}
                      ${stage === 'closed_lost' ? `<div style="margin-top:4px;"><span class="status-badge closed">Closed Lost</span></div>` : ''}
                    </div>
                  `;
                }).join('') : `
                  <div style="text-align:center;padding:16px;color:var(--text-muted);font-size:12px;">
                    No deals
                  </div>
                `}
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

window.dragDeal = function(event, dealId) {
  pipelineDragItem = dealId;
  event.dataTransfer.effectAllowed = 'move';
};

window.dropDeal = async function(event, newStage) {
  event.preventDefault();
  if (!pipelineDragItem) return;

  const closedStages = ['closed_won', 'closed_lost'];
  if (newStage === 'closed_won' || newStage === 'closed_lost') {
    const confirmMsg = newStage === 'closed_won' ? 'Mark this deal as Closed Won?' : 'Mark this deal as Closed Lost?';
    if (!confirm(confirmMsg)) return;
  }

  try {
    await api.updateDealStage(pipelineDragItem, newStage, '');
    pipelineDragItem = null;
    renderToast(`Deal moved to ${getStageDisplayName(newStage)}`, 'success');
    App.render();
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

window.showDealDetail = async function(dealId) {
  try {
    const data = await api.getDeals({});
    const deal = (data.deals || []).find(d => d.id === dealId);
    if (!deal) { renderToast('Deal not found', 'error'); return; }

    const franchisee = deal.franchiseeUser || {};
    const listing = deal.franchiseListing || deal.listing || {};
    const fName = `${franchisee.firstName || ''} ${franchisee.lastName || ''}`.trim() || 'Unknown';

    const stageOptions = DEAL_STAGES.map(s => `
      <option value="${s}" ${s === deal.stage ? 'selected' : ''}>${getStageDisplayName(s)}</option>
    `).join('');

    const content = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <div style="font-weight:600;font-size:15px;">${App.escapeHtml(fName)}</div>
          <div style="font-size:13px;color:var(--text-muted);">${App.escapeHtml(listing.title || '')}</div>
        </div>
        <div class="info-grid">
          <div class="info-group"><label>Estimated Value</label><div class="value">${App.formatCurrency(deal.estimatedValue)}</div></div>
          <div class="info-group"><label>Created</label><div class="value">${App.formatDate(deal.createdAt)}</div></div>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Update Stage</label>
          <select id="dealStageSelect" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;">${stageOptions}</select>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Notes</label>
          <textarea id="dealStageNotes" rows="2" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;resize:vertical;" placeholder="Optional notes..."></textarea>
        </div>
        <button class="btn btn-primary" onclick="updateDealStageFromModal('${dealId}')">Update Stage</button>
      </div>
    `;
    renderModal('dealDetailModal', 'Deal Detail', content);
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

window.updateDealStageFromModal = async function(dealId) {
  const stage = document.getElementById('dealStageSelect')?.value;
  const notes = document.getElementById('dealStageNotes')?.value || '';
  if (!stage) return;
  try {
    await api.updateDealStage(dealId, stage, notes);
    document.getElementById('dealDetailModal')?.remove();
    renderToast(`Deal moved to ${getStageDisplayName(stage)}`, 'success');
    App.render();
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

async function renderFranchisorTeam() {
  $('pageTitle').innerHTML = 'Team';

  try {
    const orgData = await api.getOrg();
    const org = orgData.organization || {};
    const members = orgData.members || [];

    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div>
          <div class="card">
            <div class="card-header"><h3>Organization</h3></div>
            <div class="card-body">
              <form id="orgForm" onsubmit="saveOrg(event)">
                <div style="display:flex;flex-direction:column;gap:12px;">
                  <div>
                    <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Organization Name</label>
                    <input type="text" name="name" value="${App.escapeHtml(org.name || '')}" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
                  </div>
                  <div>
                    <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Website</label>
                    <input type="url" name="website" value="${App.escapeHtml(org.website || '')}" placeholder="https://example.com" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
                  </div>
                  <div>
                    <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Logo URL</label>
                    <input type="url" name="logo" value="${App.escapeHtml(org.logo || '')}" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
                  </div>
                  <button type="submit" class="btn btn-primary">Save Organization</button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div>
          <div class="card">
            <div class="card-header">
              <h3>Members (${members.length})</h3>
              <button class="btn btn-sm btn-primary" onclick="showInviteMemberModal()">+ Invite</button>
            </div>
            <div class="card-body" style="padding:0;">
              ${members.length ? `
                <div class="table-wrap"><table>
                  <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
                  <tbody>${members.map(m => {
                    const mName = `${m.firstName || m.name || ''} ${m.lastName || ''}`.trim() || m.email || 'Unknown';
                    const isPrimary = m.role === 'owner' || m.isPrimary;
                    return `
                      <tr>
                        <td style="font-weight:600;">${App.escapeHtml(mName)} ${isPrimary ? '<span class="status-badge active" style="font-size:10px;">Primary</span>' : ''}</td>
                        <td style="font-size:13px;">${App.escapeHtml(m.email || '-')}</td>
                        <td>${renderStatusBadge(m.memberRole || m.role || 'member')}</td>
                        <td style="font-size:13px;color:var(--text-muted);">${App.formatDate(m.createdAt || m.joinedAt)}</td>
                      </tr>
                    `;
                  }).join('')}</tbody>
                </table></div>
              ` : `
                <div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">No members yet.</div>
              `}
            </div>
          </div>
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

window.saveOrg = async function(event) {
  event.preventDefault();
  const form = document.getElementById('orgForm');
  if (!form) return;
  const fd = new FormData(form);
  const data = {
    name: fd.get('name') || undefined,
    website: fd.get('website') || undefined,
    logo: fd.get('logo') || undefined,
  };
  try {
    await api.updateOrg(data);
    renderToast('Organization saved!', 'success');
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

window.showInviteMemberModal = function() {
  const content = `
    <form id="inviteForm" onsubmit="inviteMember(event)">
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Email Address</label>
          <input type="email" name="email" required placeholder="colleague@example.com" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Role</label>
          <select name="role" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary">Send Invitation</button>
      </div>
    </form>
  `;
  renderModal('inviteMemberModal', 'Invite Team Member', content);
};

window.inviteMember = async function(event) {
  event.preventDefault();
  const form = document.getElementById('inviteForm');
  if (!form) return;
  const fd = new FormData(form);
  const email = fd.get('email');
  const memberRole = fd.get('role');
  try {
    await api.inviteOrgMember(email, memberRole);
    document.getElementById('inviteMemberModal')?.remove();
    renderToast('Invitation sent!', 'success');
    App.render();
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

async function renderFranchisorReviews() {
  $('pageTitle').innerHTML = 'Reviews';

  try {
    const brandsData = await api.getBrands();
    const brands = brandsData.brands || [];
    let allReviews = [];
    let totalRating = 0;
    let reviewCount = 0;

    for (const b of brands) {
      try {
        const listings = await api.getBrandListings(b.id);
        const bListings = listings.listings || [];
        for (const l of bListings) {
          const detail = await api.getListingDetail(l.id);
          const reviews = detail.reviews || [];
          reviews.forEach(r => {
            allReviews.push({ ...r, brandName: b.name, listingTitle: l.title });
            totalRating += r.rating || 0;
          });
          reviewCount += reviews.length;
        }
      } catch { /* skip */ }
    }

    const avgRating = reviewCount > 0 ? (totalRating / reviewCount).toFixed(1) : 0;

    return `
      <div style="margin-bottom:16px;">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Average Rating</div>
            <div class="stat-value">${avgRating} ★</div>
            <div class="stat-sub">${reviewCount} reviews across ${brands.length} brands</div>
          </div>
        </div>
      </div>

      ${allReviews.length ? allReviews.map(r => `
        <div class="card" style="margin-bottom:12px;">
          <div class="card-body">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
              <span style="font-weight:600;font-size:14px;">${App.escapeHtml(r.user?.firstName || r.user?.name || 'Anonymous')}</span>
              <span class="tag">${App.escapeHtml(r.brandName || '')}</span>
              <span class="tag">${App.escapeHtml(r.listingTitle || '')}</span>
            </div>
            <div style="font-size:13px;color:#F59E0B;margin-bottom:6px;">
              ${'★'.repeat(Math.round(r.rating || 0))}${'☆'.repeat(5 - Math.round(r.rating || 0))}
              <span style="color:var(--text-muted);margin-left:8px;">${r.rating || 0}/5</span>
            </div>
            <p style="font-size:13px;color:var(--text-muted);margin:0 0 8px;">${App.escapeHtml(r.content || r.comment || '')}</p>
            <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text-muted);">
              <span>${App.formatDate(r.createdAt)}</span>
              <span>·</span>
              ${renderStatusBadge(r.status || 'published')}
              <button class="btn btn-sm btn-danger" style="margin-left:auto;" onclick="flagReview('${r.id}')">Flag Inappropriate</button>
            </div>
          </div>
        </div>
      `).join('') : `
        <div class="empty-state">
          <span class="empty-icon">⭐</span>
          <p>No reviews yet across your brands.</p>
        </div>
      `}
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

window.flagReview = async function(reviewId) {
  renderToast('Review flagged for moderation.', 'success');
};

async function renderFranchisorSettings() {
  $('pageTitle').innerHTML = 'Settings';

  try {
    const orgData = await api.getOrg();
    const org = orgData.organization || {};

    return `
      <div style="max-width:640px;">
        <div class="card">
          <div class="card-header"><h3>Organization Settings</h3></div>
          <div class="card-body">
            <form id="settingsOrgForm" onsubmit="saveSettingsOrg(event)">
              <div style="display:flex;flex-direction:column;gap:14px;">
                <div>
                  <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Organization Name</label>
                  <input type="text" name="name" value="${App.escapeHtml(org.name || '')}" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
                </div>
                <div>
                  <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Website</label>
                  <input type="url" name="website" value="${App.escapeHtml(org.website || '')}" placeholder="https://example.com" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
                </div>
                <div>
                  <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Logo URL</label>
                  <input type="url" name="logo" value="${App.escapeHtml(org.logo || '')}" placeholder="https://example.com/logo.png" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;" />
                </div>
                <button type="submit" class="btn btn-primary">Save Settings</button>
              </div>
            </form>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Notification Preferences</h3></div>
          <div class="card-body">
            <p style="font-size:14px;color:var(--text-muted);margin-bottom:12px;">Notification preferences will be available in a future update.</p>
            <div style="display:flex;flex-direction:column;gap:10px;">
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
                <input type="checkbox" checked disabled /> New lead notifications
              </label>
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
                <input type="checkbox" checked disabled /> Deal stage changes
              </label>
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
                <input type="checkbox" checked disabled /> New messages
              </label>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Account</h3></div>
          <div class="card-body">
            <div style="display:flex;flex-direction:column;gap:10px;">
              <div style="font-size:14px;">
                <span style="color:var(--text-muted);">Signed in as:</span>
                <span style="font-weight:600;">${App.escapeHtml(App.user?.email || '')}</span>
              </div>
              <button class="btn btn-outline" onclick="window.location.href='auth.html'">Manage Account</button>
            </div>
          </div>
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

window.saveSettingsOrg = async function(event) {
  event.preventDefault();
  const form = document.getElementById('settingsOrgForm');
  if (!form) return;
  const fd = new FormData(form);
  const data = {
    name: fd.get('name') || undefined,
    website: fd.get('website') || undefined,
    logo: fd.get('logo') || undefined,
  };
  try {
    await api.updateOrg(data);
    renderToast('Settings saved!', 'success');
  } catch (err) {
    renderToast(err.message, 'error');
  }
};
