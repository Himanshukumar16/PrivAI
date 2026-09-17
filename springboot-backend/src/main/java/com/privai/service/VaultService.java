package com.privai.service;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class VaultService {

    private static class SessionData {
        final Map<String, String> tokenToRaw = new ConcurrentHashMap<>();
        final Map<String, String> rawToToken = new ConcurrentHashMap<>();
        final Map<String, AtomicInteger> typeCounters = new ConcurrentHashMap<>();
        volatile long lastAccessed = System.currentTimeMillis();
    }

    private final Map<String, SessionData> sessions = new ConcurrentHashMap<>();

    private SessionData getOrCreateSession(String sessionId) {
        String key = (sessionId != null && !sessionId.isBlank()) ? sessionId : "default";
        SessionData data = sessions.computeIfAbsent(key, k -> new SessionData());
        data.lastAccessed = System.currentTimeMillis();
        return data;
    }

    public String getOrRegisterToken(String sessionId, String entityType, String rawValue) {
        if (rawValue == null || rawValue.isBlank()) return "";
        SessionData session = getOrCreateSession(sessionId);

        // Check if raw value already mapped
        String existingToken = session.rawToToken.get(rawValue);
        if (existingToken != null) {
            return existingToken;
        }

        String cleanType = entityType.toUpperCase().replaceAll("[^A-Z0-9_]", "");
        AtomicInteger counter = session.typeCounters.computeIfAbsent(cleanType, k -> new AtomicInteger(0));
        int nextId = counter.incrementAndGet();

        String token = "[" + cleanType + "_" + nextId + "]";
        session.tokenToRaw.put(token, rawValue);
        session.rawToToken.put(rawValue, token);

        return token;
    }

    public Map<String, String> getTokenMap(String sessionId) {
        SessionData session = getOrCreateSession(sessionId);
        return Map.copyOf(session.tokenToRaw);
    }

    public String reconstruct(String sessionId, String text) {
        if (text == null || text.isBlank()) return text;
        SessionData session = getOrCreateSession(sessionId);

        String result = text;
        for (Map.Entry<String, String> entry : session.tokenToRaw.entrySet()) {
            String token = entry.getKey();
            String raw = entry.getValue();
            if (result.contains(token)) {
                result = result.replace(token, raw);
            }
        }
        return result;
    }

    public int countUnmaskedTokens(String sessionId, String text) {
        if (text == null || text.isBlank()) return 0;
        SessionData session = getOrCreateSession(sessionId);
        int count = 0;
        for (String token : session.tokenToRaw.keySet()) {
            if (text.contains(token)) {
                count++;
            }
        }
        return count;
    }

    public void clearSession(String sessionId) {
        if (sessionId != null) {
            sessions.remove(sessionId);
        }
    }
}
