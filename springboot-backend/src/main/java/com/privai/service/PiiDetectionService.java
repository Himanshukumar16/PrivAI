package com.privai.service;

import com.privai.model.DetectedEntity;
import com.privai.model.SanitizeResponse;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class PiiDetectionService {

    private final VaultService vaultService;

    // Verhoeff tables
    private static final int[][] VERHOEFF_D = {
            {0, 1, 2, 3, 4, 5, 6, 7, 8, 9},
            {1, 2, 3, 4, 0, 6, 7, 8, 9, 5},
            {2, 3, 4, 0, 1, 7, 8, 9, 5, 6},
            {3, 4, 0, 1, 2, 8, 9, 5, 6, 7},
            {4, 0, 1, 2, 3, 9, 5, 6, 7, 8},
            {5, 9, 8, 7, 6, 0, 4, 3, 2, 1},
            {6, 5, 9, 8, 7, 1, 0, 4, 3, 2},
            {7, 6, 5, 9, 8, 2, 1, 0, 4, 3},
            {8, 7, 6, 5, 9, 3, 2, 1, 0, 4},
            {9, 8, 7, 6, 5, 4, 3, 2, 1, 0}
    };

    private static final int[][] VERHOEFF_P = {
            {0, 1, 2, 3, 4, 5, 6, 7, 8, 9},
            {1, 5, 7, 6, 2, 8, 3, 0, 9, 4},
            {5, 8, 0, 3, 7, 9, 6, 1, 4, 2},
            {8, 9, 1, 6, 0, 4, 3, 5, 2, 7},
            {9, 4, 5, 3, 1, 2, 6, 8, 7, 0},
            {4, 2, 8, 6, 5, 7, 3, 9, 0, 1},
            {2, 7, 9, 3, 8, 0, 6, 4, 1, 5},
            {7, 0, 4, 6, 9, 1, 3, 2, 5, 8}
    };

    // Precompiled Regex Patterns
    private static final Pattern JWT_PATTERN = Pattern.compile("\\beyJ[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.?[A-Za-z0-9-_.+/=]*\\b");
    private static final Pattern API_KEY_PATTERN = Pattern.compile("\\b(?:sk-[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|AIza[0-9A-Za-z-_]{35})\\b");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b");
    private static final Pattern CREDIT_CARD_PATTERN = Pattern.compile("\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b|\\b\\d{13,19}\\b");
    private static final Pattern AADHAAR_PATTERN = Pattern.compile("\\b[2-9]\\d{3}[\\s\\-]?[0-9]{4}[\\s\\-]?[0-9]{4}(?![\\s\\-]?\\d)\\b");
    private static final Pattern PAN_PATTERN = Pattern.compile("\\b[A-Z]{5}[0-9]{4}[A-Z]\\b");
    private static final Pattern PASSPORT_PATTERN = Pattern.compile("\\b[A-PR-WYa-pr-wy][1-9]\\d\\s?\\d{4}[1-9]\\b");
    private static final Pattern INDIAN_PHONE_PATTERN = Pattern.compile("(?:\\+91[\\-\\s]?)?[6-9]\\d{4}[\\-\\s]?\\d{5}\\b");
    private static final Pattern GLOBAL_PHONE_PATTERN = Pattern.compile("\\b(?:\\+?\\d{1,3}[-.\\s]?)?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}\\b");
    private static final Pattern IFSC_PATTERN = Pattern.compile("\\b[A-Z]{4}0[A-Z0-9]{6}\\b");
    private static final Pattern UPI_PATTERN = Pattern.compile("\\b[a-zA-Z0-9.\\-_]{2,256}@(okhdfcbank|okaxis|oksbi|okicici|paytm|ybl|apl|upi)\\b", Pattern.CASE_INSENSITIVE);

    public PiiDetectionService(VaultService vaultService) {
        this.vaultService = vaultService;
    }

    public static boolean validateVerhoeff(String numStr) {
        if (numStr == null) return false;
        String clean = numStr.replaceAll("\\D", "");
        if (clean.length() != 12) return false;
        int c = 0;
        int[] reversed = new int[clean.length()];
        for (int i = 0; i < clean.length(); i++) {
            reversed[i] = Character.getNumericValue(clean.charAt(clean.length() - 1 - i));
        }
        for (int i = 0; i < reversed.length; i++) {
            c = VERHOEFF_D[c][VERHOEFF_P[i % 8][reversed[i]]];
        }
        return c == 0;
    }

    public static boolean validateLuhn(String ccStr) {
        if (ccStr == null) return false;
        String clean = ccStr.replaceAll("\\D", "");
        if (clean.length() < 13 || clean.length() > 19) return false;
        int sum = 0;
        boolean shouldDouble = false;
        for (int i = clean.length() - 1; i >= 0; i--) {
            int digit = Character.getNumericValue(clean.charAt(i));
            if (shouldDouble) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
            shouldDouble = !shouldDouble;
        }
        return sum % 10 == 0;
    }

    public static boolean validatePan(String panStr) {
        if (panStr == null) return false;
        String clean = panStr.trim().toUpperCase();
        if (!clean.matches("^[A-Z]{5}[0-9]{4}[A-Z]$")) return false;
        char fourth = clean.charAt(3);
        return "PCHFATBLJG".indexOf(fourth) != -1;
    }

    public List<DetectedEntity> detect(String text, Map<String, Boolean> categories) {
        if (text == null || text.isBlank()) return Collections.emptyList();
        List<DetectedEntity> detected = new ArrayList<>();

        boolean checkSecrets = isEnabled(categories, "secrets");
        boolean checkEmail = isEnabled(categories, "email");
        boolean checkCc = isEnabled(categories, "creditCard");
        boolean checkAadhaar = isEnabled(categories, "aadhaar");
        boolean checkPan = isEnabled(categories, "pan");
        boolean checkPassport = isEnabled(categories, "passport");
        boolean checkPhone = isEnabled(categories, "phone");
        boolean checkBank = isEnabled(categories, "bankInfo");

        // 1. Secrets & JWT
        if (checkSecrets) {
            Matcher m = JWT_PATTERN.matcher(text);
            while (m.find()) {
                addNonOverlapping(detected, new DetectedEntity("JWT_TOKEN", m.group(), m.start(), m.end(), 0.99, null));
            }
            m = API_KEY_PATTERN.matcher(text);
            while (m.find()) {
                addNonOverlapping(detected, new DetectedEntity("API_KEY", m.group(), m.start(), m.end(), 0.95, null));
            }
        }

        // 2. Email
        if (checkEmail) {
            Matcher m = EMAIL_PATTERN.matcher(text);
            while (m.find()) {
                addNonOverlapping(detected, new DetectedEntity("EMAIL", m.group(), m.start(), m.end(), 0.99, null));
            }
        }

        // 3. Credit Card (Evaluated before Aadhaar)
        if (checkCc) {
            Matcher m = CREDIT_CARD_PATTERN.matcher(text);
            while (m.find()) {
                String raw = m.group();
                if (validateLuhn(raw)) {
                    addNonOverlapping(detected, new DetectedEntity("CREDIT_CARD", raw, m.start(), m.end(), 1.0, null));
                }
            }
        }

        // 4. Aadhaar (12-digit boundary)
        if (checkAadhaar) {
            Matcher m = AADHAAR_PATTERN.matcher(text);
            while (m.find()) {
                String raw = m.group();
                boolean validVerhoeff = validateVerhoeff(raw);
                addNonOverlapping(detected, new DetectedEntity("AADHAAR", raw, m.start(), m.end(), validVerhoeff ? 1.0 : 0.85, null));
            }
        }

        // 5. PAN Card
        if (checkPan) {
            Matcher m = PAN_PATTERN.matcher(text);
            while (m.find()) {
                String raw = m.group();
                boolean validStructure = validatePan(raw);
                addNonOverlapping(detected, new DetectedEntity("PAN", raw, m.start(), m.end(), validStructure ? 1.0 : 0.88, null));
            }
        }

        // 6. Passport
        if (checkPassport) {
            Matcher m = PASSPORT_PATTERN.matcher(text);
            while (m.find()) {
                addNonOverlapping(detected, new DetectedEntity("PASSPORT", m.group(), m.start(), m.end(), 0.90, null));
            }
        }

        // 7. Bank: IFSC & UPI
        if (checkBank) {
            Matcher m = IFSC_PATTERN.matcher(text);
            while (m.find()) {
                addNonOverlapping(detected, new DetectedEntity("IFSC_CODE", m.group(), m.start(), m.end(), 0.95, null));
            }
            m = UPI_PATTERN.matcher(text);
            while (m.find()) {
                addNonOverlapping(detected, new DetectedEntity("UPI_ID", m.group(), m.start(), m.end(), 0.98, null));
            }
        }

        // 8. Phone Numbers
        if (checkPhone) {
            Matcher m = INDIAN_PHONE_PATTERN.matcher(text);
            while (m.find()) {
                addNonOverlapping(detected, new DetectedEntity("PHONE", m.group(), m.start(), m.end(), 0.92, null));
            }
            m = GLOBAL_PHONE_PATTERN.matcher(text);
            while (m.find()) {
                String digits = m.group().replaceAll("\\D", "");
                if (digits.length() >= 10 && digits.length() <= 15) {
                    addNonOverlapping(detected, new DetectedEntity("PHONE", m.group(), m.start(), m.end(), 0.88, null));
                }
            }
        }

        detected.sort(Comparator.comparingInt(DetectedEntity::getStart));
        return detected;
    }

    private void addNonOverlapping(List<DetectedEntity> list, DetectedEntity candidate) {
        for (DetectedEntity existing : list) {
            if (!(candidate.getEnd() <= existing.getStart() || candidate.getStart() >= existing.getEnd())) {
                return; // Overlaps, discard
            }
        }
        list.add(candidate);
    }

    private boolean isEnabled(Map<String, Boolean> categories, String key) {
        if (categories == null || !categories.containsKey(key)) return true;
        return Boolean.TRUE.equals(categories.get(key));
    }

    public SanitizeResponse sanitize(String text, String sessionId, Map<String, Boolean> categories) {
        long start = System.currentTimeMillis();
        List<DetectedEntity> entities = detect(text, categories);

        if (entities.isEmpty()) {
            return new SanitizeResponse(text, Collections.emptyList(), Collections.emptyMap(), System.currentTimeMillis() - start);
        }

        StringBuilder sb = new StringBuilder();
        int lastIndex = 0;
        Map<String, String> tokenMap = new HashMap<>();

        for (DetectedEntity entity : entities) {
            sb.append(text, lastIndex, entity.getStart());
            String token = vaultService.getOrRegisterToken(sessionId, entity.getType(), entity.getValue());
            entity.setToken(token);
            tokenMap.put(token, entity.getValue());
            sb.append(token);
            lastIndex = entity.getEnd();
        }
        sb.append(text.substring(lastIndex));

        long duration = System.currentTimeMillis() - start;
        return new SanitizeResponse(sb.toString(), entities, tokenMap, duration);
    }
}
