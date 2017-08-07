class InputStream{
  /** use for template literal:
   *   InputStream.tag`div my text`
   */
  static tag(segments, ...interpolates)
  {
    return this.create(segments, interpolates);
  }

  static create(segments, interpolates)
  {
    const obj = new this(segments, ...interpolates);
    obj.loadValues(segments, interpolates);
    return obj;
  }

  /** Don't new this class directly from outside. Use .tag instead
   */
  constructor()
  {
    // nop. properties will be set afterward
  }

  /** Load values from template literal.
   *
   * @param {Array.<string>} segments strings
   * @param {Array.<object>} interpolates values
   */
  loadValues(segments, interpolates)
  {
    // copy the arguments
    this.segments = [].concat(segments);
    this.interpolates = [].concat(interpolates);
    this.currentSegment = this.segments.shift();
    // we cannot know the exact lineno in the whole template literal,
    // so we count the lineno from the last interpolation.
    this.linenoWithinSegment = 1;
    if (!this.currentSegment){
      throw new Error("segments is empty");
    }
    return this;
  }

  copyStateFrom(other)
  {
    this.segments = Array.from(other.segments);
    this.interpolates = Array.from(other.interpolates);
    this.currentSegment = other.currentSegment;
    this.linenoWithinSegment = other.linenoWithinSegment;
    return this;
  }

  clone()
  {
    const obj = new InputStream();
    obj.copyStateFrom(this);
    return obj;
  }

  /** Try match against the current segment and advance stream if matched.
   * @param {regexp} regex should start with '^'
   * @return {matchdata|null}
   */
  consume(regex)
  {
    const md = regex.exec(this.currentSegment);
    if (md){
      if (md.index != 0){
        throw new Error("regex must start with ^");
      }
      this.linenoWithinSegment += (md[0].match(/\n/g) || []).length;
      if (md[0].length > 0){
        this.currentSegment = this.currentSegment.slice(md[0].length);
      }
      return md;
    }else{
      return null;
    }
  }

  /** Same as consume, but returns the matched string instead of matchdata.
   * @param {RegExp} regex
   * @return {string|null}
   */
  consumeMatched(regex)
  {
    const md = this.consume(regex);
    return md && md[0];
  }

  /** Same as consume, but returns the nth capture of regex
   * @param {RegExp} regex
   * @param {integer} nth
   * @return {string|null}
   */
  consumeCaptured(regex, nth=1)
  {
    const md = this.consume(regex);
    return md && md[nth];
  }

  consumeString(str)
  {
    if (this.currentSegment.startsWith(str)){
      this.currentSegment = this.currentSegment.slice(str.length);
      return str;
    }else{
      return null;
    }
  }

  /** try match like consume, but doesn't change the current segment.
   *
   * @param {RegExp} regex
   * @return {matchdata|null}
   */
  peek(regex)
  {
    return regex.exec(this.currentSegment);
  }

  /** same as peek, but succeed only when input reaches EOF after match
   *
   * @param {RegExp} regex
   * @return {matchdata|null}
   */
  peekToEoF(regex)
  {
    const md = regex.exec(this.currentSegment);
    if (md &&
        this.currentSegment.length === md[0].length &&
        this.segments.length == 0 &&
        this.interpolates.length == 0){
      return md;
    }else{
      return null;
    }
  }

  /**
   * @return {object|null} object has an only attribute 'value'
   */
  consumeInterpolate()
  {
    if (!this.segmentFinished()){
      return null;
    }
    if (this.interpolates.length === 0){
      return null;
    }
    this.linenoWithinSegment = 1;
    this.currentSegment = this.segments.shift();
    return { value: this.interpolates.shift() };
  }

  ignoreInterpolate()
  {
    this.consumeInterpolate();
  }

  peekString(str)
  {
    return this.currentSegment.startsWith(str);
  }

  segmentFinished()
  {
    return this.currentSegment.length == 0;
  }

  isEoF()
  {
    return this.segmentFinished() &&
      this.segments.length == 0 &&
      this.interpolates.length == 0;
  }

  /** Invoke f with copied InputStream. If f returns non-null value,
   *  import the state of the copied stream. Otherwise, the state of
   *  this remains unchanged. Return the value from f.
   *
   * @param {InputStream->obj|null} f function
   * @return {obj|null} value from f
   */
  tryParse(f)
  {
    const newStream = this.clone();
    const val = f(newStream);
    if (val != null){
      this.copyStateFrom(newStream);
    }
    return val;
  }
}

module.exports = InputStream;
