import json

# Mapping of abbreviations to full district names
abbr_mapping = {
    "ALN": "N.D. Ala.",
    "ALM": "M.D. Ala.",
    "ALS": "S.D. Ala.",
    "AK": "D. Alaska",
    "AZ": "D. Ariz.",
    "ARE": "E.D. Ark.",
    "ARW": "W.D. Ark.",
    "CAC": "C.D. Cal.",
    "CAE": "E.D. Cal.",
    "CAN": "N.D. Cal.",
    "CAS": "S.D. Cal.",
    "CO": "D. Colo.",
    "CT": "D. Conn.",
    "DE": "D. Del.",
    "DC": "D.D.C.",
    "FLM": "M.D. Fla.",
    "FLN": "N.D. Fla.",
    "FLS": "S.D. Fla.",
    "GAM": "M.D. Ga.",
    "GAN": "N.D. Ga.",
    "GAS": "S.D. Ga.",
    "HI": "D. Haw.",
    "ID": "D. Idaho",
    "ILN": "N.D. Ill.",
    "ILC": "C.D. Ill.",
    "ILS": "S.D. Ill.",
    "INN": "N.D. Ind.",
    "INS": "S.D. Ind.",
    "IAN": "N.D. Iowa",
    "IAS": "S.D. Iowa",
    "KS": "D. Kan.",
    "KYE": "E.D. Ky.",
    "KYW": "W.D. Ky.",
    "LAE": "E.D. La.",
    "LAM": "M.D. La.",
    "LAW": "W.D. La.",
    "ME": "D. Me.",
    "MD": "D. Md.",
    "MA": "D. Mass.",
    "MIE": "E.D. Mich.",
    "MIW": "W.D. Mich.",
    "MN": "D. Minn.",
    "MSN": "N.D. Miss.",
    "MSS": "S.D. Miss.",
    "MOE": "E.D. Mo.",
    "MOW": "W.D. Mo.",
    "MT": "D. Mont.",
    "NE": "D. Neb.",
    "NV": "D. Nev.",
    "NH": "D.N.H.",
    "NJ": "D.N.J.",
    "NM": "D.N.M.",
    "NYE": "E.D.N.Y.",
    "NYN": "N.D.N.Y.",
    "NYS": "S.D.N.Y.",
    "NYW": "W.D.N.Y.",
    "NCE": "E.D.N.C.",
    "NCM": "M.D.N.C.",
    "NCW": "W.D.N.C.",
    "ND": "D.N.D.",
    "OHN": "N.D. Ohio",
    "OHS": "S.D. Ohio",
    "OKE": "E.D. Okla.",
    "OKN": "N.D. Okla.",
    "OKW": "W.D. Okla.",
    "OR": "D. Or.",
    "PAE": "E.D. Pa.",
    "PAM": "M.D. Pa.",
    "PAW": "W.D. Pa.",
    "PR": "D.P.R.",
    "RI": "D.R.I.",
    "SC": "D.S.C.",
    "SD": "D.S.D.",
    "TNE": "E.D. Tenn.",
    "TNM": "M.D. Tenn.",
    "TNW": "W.D. Tenn.",
    "TXE": "E.D. Tex.",
    "TXN": "N.D. Tex.",
    "TXS": "S.D. Tex.",
    "TXW": "W.D. Tex.",
    "UT": "D. Utah",
    "VT": "D. Vt.",
    "VAE": "E.D. Va.",
    "VAW": "W.D. Va.",
    "WAE": "E.D. Wash.",
    "WAW": "W.D. Wash.",
    "WVN": "N.D. W. Va.",
    "WVS": "S.D. W. Va.",
    "WIE": "E.D. Wis.",
    "WIW": "W.D. Wis.",
    "WY": "D. Wyo."
}

# Load districts.json
with open('data/districts.json', 'r') as f:
    districts = json.load(f)

# Add abbreviation field to each district
updated_districts = {}
for full_name, info in districts.items():
    # Find the abbreviation for this district
    abbr = None
    for abb, fname in abbr_mapping.items():
        if fname == full_name:
            abbr = abb
            break
    
    # Add abbreviation to the district info
    if abbr:
        info['abbreviation'] = abbr
        updated_districts[full_name] = info
        # Also add the abbreviation as a key pointing to the same data
        updated_districts[abbr] = {**info, 'name': full_name}
    else:
        updated_districts[full_name] = info

# Save updated districts.json
with open('data/districts.json', 'w') as f:
    json.dump(updated_districts, f, indent=2)

print(f"Added abbreviations to {len([k for k in updated_districts.keys() if '.' not in k])} districts")
