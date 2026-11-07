Pod::Spec.new do |s|
  s.name           = 'RallyIntelligence'
  s.version        = '1.0.0'
  s.summary        = 'Apple Intelligence (on-device Foundation Models) for Rally'
  s.license        = 'MIT'
  s.author         = 'Jean'
  s.homepage       = 'https://example.com'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.swift_version  = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
