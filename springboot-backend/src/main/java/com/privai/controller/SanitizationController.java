package com.privai.controller;

import com.privai.model.ReconstructRequest;
import com.privai.model.ReconstructResponse;
import com.privai.model.SanitizeRequest;
import com.privai.model.SanitizeResponse;
import com.privai.service.PiiDetectionService;
import com.privai.service.VaultService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@CrossOrigin(origins = "*")
public class SanitizationController {

    private final PiiDetectionService detectionService;
    private final VaultService vaultService;

    public SanitizationController(PiiDetectionService detectionService, VaultService vaultService) {
        this.detectionService = detectionService;
        this.vaultService = vaultService;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "PrivAI Enterprise Engine",
                "version", "1.0.0",
                "timestamp", System.currentTimeMillis()
        ));
    }

    @PostMapping("/sanitize")
    public ResponseEntity<SanitizeResponse> sanitize(@RequestBody SanitizeRequest request) {
        if (request.getText() == null) {
            return ResponseEntity.badRequest().build();
        }
        SanitizeResponse response = detectionService.sanitize(
                request.getText(),
                request.getSessionId(),
                request.getCategories()
        );
        return ResponseEntity.ok(response);
    }

    @PostMapping("/reconstruct")
    public ResponseEntity<ReconstructResponse> reconstruct(@RequestBody ReconstructRequest request) {
        long start = System.currentTimeMillis();
        if (request.getText() == null) {
            return ResponseEntity.badRequest().build();
        }
        String sessionId = request.getSessionId();
        int count = vaultService.countUnmaskedTokens(sessionId, request.getText());
        String reconstructed = vaultService.reconstruct(sessionId, request.getText());
        long duration = System.currentTimeMillis() - start;

        return ResponseEntity.ok(new ReconstructResponse(reconstructed, count, duration));
    }

    @GetMapping("/rules")
    public ResponseEntity<List<String>> getSupportedRules() {
        return ResponseEntity.ok(List.of(
                "AADHAAR (Verhoeff Checksum)",
                "PAN (Tax ID Format & Status)",
                "PASSPORT (Indian & International)",
                "CREDIT_CARD (Luhn Algorithm)",
                "EMAIL",
                "PHONE (Indian Mobile & International)",
                "BANK_IFSC",
                "UPI_ID",
                "JWT_TOKEN",
                "API_KEY (OpenAI, AWS, GitHub)"
        ));
    }
}
