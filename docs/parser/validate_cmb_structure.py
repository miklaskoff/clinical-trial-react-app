import json
import sys
from collections import Counter

def validate_structure(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    print(f"Loaded {len(data)} records.")
    
    allowed_fields = {
        # Required passport fields
        "id", "nct_id", "raw_text", "_thought_process",
        # Required schema fields (from OUTPUT_SCHEMAS.json)
        "CRITERION_TYPE", "EXCLUSION_STRENGTH", "confidence", "parsing_status",
        # CMB-specific fields
        "CONDITION_TYPE", "CONDITION_PATTERN", "SEVERITY", "MEASUREMENTS",
        "EXCEPTION_CONDITION", "NEGATION_DETECTED", "NESTED_CONDITION", "LOGICAL_OPERATOR",
        # Optional/metadata fields
        "ANATOMICAL_LOCATION", "TIMEFRAME", "REQUIRES_CLINICAL_JUDGMENT",
        "SUBJECTIVE_ESTIMATE", "AMBIGUITY_FLAG", "unfamiliar_term_flag",
        # Preserved original data
        "original", "ambiguity_reason"
    }
    
    errors = []
    field_usage = Counter()
    nested_count = 0
    
    for item in data:
        keys = set(item.keys())
        unknown_keys = keys - allowed_fields
        if unknown_keys:
            errors.append(f"ID {item.get('id')}: Unknown fields {unknown_keys}")
        
        for key in keys:
            field_usage[key] += 1
            
        if "NESTED_CONDITION" in item:
            nested_count += 1
            
    print("\nField Usage Stats:")
    for field, count in field_usage.most_common():
        print(f"{field}: {count}")
        
    print(f"\nRecords with NESTED_CONDITION: {nested_count}")
    
    if errors:
        print(f"\nFound {len(errors)} structure errors:")
        for err in errors[:10]:
            print(err)
        if len(errors) > 10:
            print("...")
        sys.exit(1)
    else:
        print("\n✅ Structure validation passed! No unknown fields found.")
        sys.exit(0)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python validate_cmb_structure.py <json_file>")
        sys.exit(1)
    validate_structure(sys.argv[1])
